/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { MessageStore, React } = require("mailspring-exports");
const { RetinaImg } = require("mailspring-component-kit");
const PGPKeyStore = require("./pgp-key-store");
const pgp = require("kbpgp");
const _ = require("underscore");
import PropTypes from 'prop-types';


// Sits next to recipient chips in the composer and turns them green/red
// depending on whether or not there's a PGP key present for that user
class RecipientKeyChip extends React.Component {
  static displayName = "RecipientKeyChip";
  static initClass() {
    this.propTypes = { contact: PropTypes.object.isRequired };    
  }

  constructor(props) {
    super(props);
    this.state = this._getStateFromStores();
		this.unlistenKeystore = PGPKeyStore.listen(this._onKeystoreChange, this);
  }

  componentDidMount() {
    // fetch the actual key(s) from disk
    const keys = PGPKeyStore.pubKeys(this.props.contact.email);
    return _.each(keys, key => PGPKeyStore.getKeyContents({ key }));
  }

  componentWillUnmount() {
    return this.unlistenKeystore();
  }

  _getStateFromStores() {
    return {
      // true if there is at least one loaded key for the account
      keys: PGPKeyStore.pubKeys(this.props.contact.email).some(
        (cv, ind, arr) => {
          return cv.hasOwnProperty("key");
        }
      )
    };
  }

  _onKeystoreChange() {
    return this.setState(this._getStateFromStores());
  }

  render() {
    if (this.state.keys) {
      return (
        <div className="n1-keybase-recipient-key-chip">
          <RetinaImg
            url="mailspring://keybase/key-present@2x.png"
            mode={RetinaImg.Mode.ContentPreserve}
            ref="keyIcon"
          />
        </div>
      );
    } else {
      return (
        <div className="n1-keybase-recipient-key-chip">
          <span ref="noKeyIcon" />
        </div>
      );
    }
  }
}
RecipientKeyChip.initClass();

module.exports = RecipientKeyChip;
