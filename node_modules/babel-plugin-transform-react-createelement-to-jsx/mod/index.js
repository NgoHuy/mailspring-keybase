import _toArray from 'babel-runtime/helpers/toArray';
/** Visitor factory for babel, converting React.createElement(...) to <jsx ...>...</jsx>
  *
  * What we want to handle here is this CallExpression:
  *
  *     React.createElement(
  *       type: StringLiteral|Identifier|MemberExpression,
  *       [props: ObjectExpression|Expression],
  *       [...children: StringLiteral|Expression]
  *     )
  *
  * Any of those arguments might also be missing (undefined) and/or invalid. */
export default function (_ref) {
	var t = _ref.types;

	/** Get a JSXElement from a CallExpression
   * Returns null if this impossible */
	function getJSXNode(node) {
		if (!isReactCreateElement(node)) return null;

		//nameNode and propsNode may be undefined, getJSX* need to handle that

		var _node$arguments = _toArray(node.arguments);

		var nameNode = _node$arguments[0];
		var propsNode = _node$arguments[1];

		var childNodes = _node$arguments.slice(2);

		var name = getJSXName(nameNode);
		if (name === null) return null; //name is required

		var props = getJSXProps(propsNode);
		if (props === null) return null; //no props → [], invalid → null

		var children = getJSXChildren(childNodes);
		if (children === null) return null; //no children → [], invalid → null

		// self-closing tag if no children
		var selfClosing = children.length === 0;
		var startTag = t.jSXOpeningElement(name, props, selfClosing);
		var endTag = selfClosing ? null : t.jSXClosingElement(name);

		return t.jSXElement(startTag, endTag, children, selfClosing);
	}

	/** Get a JSXIdentifier or JSXMemberExpression from a Node of known type.
   * Returns null if a unknown node type, null or undefined is passed. */
	function getJSXName(node) {
		if (node == null) return null;

		var name = getJSXIdentifier(node);
		if (name !== null) return name;

		if (!t.isMemberExpression(node)) return null;
		var object = getJSXName(node.object);
		var property = getJSXName(node.property);
		if (object === null || property === null) return null;
		return t.jSXMemberExpression(object, property);
	}

	/** Get a array of JSX(Spread)Attribute from a props ObjectExpression.
   * Handles the _extends Expression babel creates from SpreadProperty nodes.
 	* Returns null if a validation error occurs. */
	function getJSXProps(node) {
		if (node == null || isNullLikeNode(node)) return [];

		if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: '_extends' })) {
			var props = node.arguments.map(getJSXProps);
			//if calling this recursively works, flatten.
			if (props.every(function (prop) {
				return prop !== null;
			})) return [].concat.apply([], props);
		}

		if (!t.isObjectExpression(node) && t.isExpression(node)) return [t.jSXSpreadAttribute(node)];

		if (!isPlainObjectExpression(node)) return null;
		return node.properties.map(function (prop) {
			return t.isObjectProperty(prop) ? t.jSXAttribute(getJSXIdentifier(prop.key), getJSXAttributeValue(prop.value)) : t.jSXSpreadAttribute(prop.argument);
		});
	}

	function getJSXChild(node) {
		if (t.isStringLiteral(node)) return t.jSXText(node.value);
		if (isReactCreateElement(node)) return getJSXNode(node);
		if (t.isExpression(node)) return t.jSXExpressionContainer(node);
		return null;
	}

	function getJSXChildren(nodes) {
		var children = nodes.filter(function (node) {
			return !isNullLikeNode(node);
		}).map(getJSXChild);
		if (children.some(function (child) {
			return child == null;
		})) return null;
		return children;
	}

	function getJSXIdentifier(node) {
		//TODO: JSXNamespacedName
		if (t.isIdentifier(node)) return t.jSXIdentifier(node.name);
		if (t.isStringLiteral(node)) return t.jSXIdentifier(node.value);
		return null;
	}

	function getJSXAttributeValue(node) {
		if (t.isStringLiteral(node)) return node;
		if (t.isJSXElement(node)) return node;
		if (t.isExpression(node)) return t.jSXExpressionContainer(node);
		return null;
	}

	/** tests if a node is a CallExpression with callee “React.createElement” */
	var isReactCreateElement = function isReactCreateElement(node) {
		return t.isCallExpression(node) && t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.object, { name: 'React' }) && t.isIdentifier(node.callee.property, { name: 'createElement' }) && !node.callee.computed;
	};

	/** Tests if a node is “null” or “undefined” */
	var isNullLikeNode = function isNullLikeNode(node) {
		return t.isNullLiteral(node) || t.isIdentifier(node, { name: 'undefined' });
	};

	/** Tests if a node is an object expression with noncomputed, nonmethod attrs */
	var isPlainObjectExpression = function isPlainObjectExpression(node) {
		return t.isObjectExpression(node) && node.properties.every(function (m) {
			return t.isSpreadProperty(m) || t.isObjectProperty(m, { computed: false }) && getJSXIdentifier(m.key) !== null && getJSXAttributeValue(m.value) !== null;
		});
	};

	return {
		visitor: {
			CallExpression: function CallExpression(path) {
				var node = getJSXNode(path.node);
				if (node === null) return null;
				path.replaceWith(node);
			}
		}
	};
}