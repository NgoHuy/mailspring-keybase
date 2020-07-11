/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import {
  Utils,
  DraftStore,
  React,
  Actions,
  DatabaseStore,
  Contact,
  ReactDOM
} from "mailspring-exports";
const PGPKeyStore = require("./pgp-key-store");
const Identity = require("./identity");
const ModalKeyRecommender = require("./modal-key-recommender");
const { RetinaImg } = require("mailspring-component-kit");
const { remote } = require("electron");
const pgp = require("kbpgp");
const _ = require("underscore");
import PropTypes from 'prop-types';

class EncryptMessageButton extends React.Component {
  static displayName = "EncryptMessageButton";
  static initClass() {

    // require that we have a draft object available
    this.propTypes = {
      draft: PropTypes.object.isRequired,
      session: PropTypes.object.isRequired
    };
  }

  constructor(props) {
    super(props);
    this._onKeystoreChange = this._onKeystoreChange.bind(this);
    this._onClick = this._onClick.bind(this);
    this._toggleCrypt = this._toggleCrypt.bind(this);
    this._encrypt = this._encrypt.bind(this);
    this._checkKeysAndEncrypt = this._checkKeysAndEncrypt.bind(this);

    // plaintext: store the message's plaintext in case the user wants to edit
    // further after hitting the "encrypt" button (i.e. so we can "undo" the
    // encryption)

    // cryptotext: store the message's body here, for comparison purposes (so
    // that if the user edits an encrypted message, we can revert it)
    this.state = { plaintext: "", cryptotext: "", currentlyEncrypted: false };
  }

  componentDidMount() {
    return (this.unlistenKeystore = PGPKeyStore.listen(
      this._onKeystoreChange,
      this
    ));
  }

  componentWillUnmount() {
    return this.unlistenKeystore();
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.state.currentlyEncrypted &&
      nextProps.draft.body !== this.props.draft.body &&
      nextProps.draft.body !== this.state.cryptotext
    ) {
      // A) we're encrypted
      // B) someone changed something
      // C) the change was AWAY from the "correct" cryptotext
      const body = this.state.cryptotext;
      return this.props.session.changes.add({ body });
    }
  }

  _getKeys() {
    const keys = [];
    for (let recipient of Array.from(
      this.props.draft.participants({ includeFrom: false, includeBcc: true })
    )) {
      const publicKeys = PGPKeyStore.pubKeys(recipient.email);
      if (publicKeys.length < 1) {
        // no key for this user
        keys.push(new Identity({ addresses: [recipient.email] }));
      } else {
        // note: this, by default, encrypts using every public key associated
        // with the address
        for (let publicKey of Array.from(publicKeys)) {
          if (publicKey.key == null) {
            PGPKeyStore.getKeyContents({ key: publicKey });
          } else {
            keys.push(publicKey);
          }
        }
      }
    }

    return keys;
  }

  _onKeystoreChange() {
    // if something changes with the keys, check to make sure the recipients
    // haven't changed (thus invalidating our encrypted message)
    if (this.state.currentlyEncrypted) {
      let newKeys = _.map(this.props.draft.participants(), participant =>
        PGPKeyStore.pubKeys(participant.email)
      );
      newKeys = _.flatten(newKeys);

      let oldKeys = _.map(this.props.draft.participants(), participant =>
        PGPKeyStore.pubKeys(participant.email)
      );
      oldKeys = _.flatten(oldKeys);

      if (newKeys.length !== oldKeys.length) {
        // someone added/removed a key - our encrypted body is now out of date
        return this._toggleCrypt();
      }
    }
  }

  render() {
    let classnames = "btn btn-toolbar";
    if (this.state.currentlyEncrypted) {
      classnames += " btn-enabled";
    }

    return (
      <div className="n1-keybase">
        <button
          title="Encrypt email body"
          className={classnames}
          onClick={() => this._onClick()}
          ref="button"
        >
          <RetinaImg
            url="mailspring://keybase/encrypt-composer-button@2x.png"
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </button>
      </div>
    );
  }

  _onClick() {
    return this._toggleCrypt();
  }

  _toggleCrypt() {
    // if decrypted, encrypt, and vice versa
    // addresses which don't have a key
    if (this.state.currentlyEncrypted) {
      // if the message is already encrypted, place the stored plaintext back
      // in the draft (i.e. un-encrypt)
      this.props.session.changes.add({ body: this.state.plaintext });
      return this.setState({ currentlyEncrypted: false });
    } else {
      // if not encrypted, save the plaintext, then encrypt
      const plaintext = this.props.draft.body;
      const identities = this._getKeys();
      return this._checkKeysAndEncrypt(
        plaintext,
        identities,
        (err, cryptotext) => {
          if (err) {
            console.warn(err);
            //Actions.recordUserEvent("Email Encryption Errored", { error: err });
            AppEnv.showErrorDialog(err);
          }
          if (cryptotext != null && cryptotext !== "") {
            // <pre> tag prevents gross HTML formatting in-flight
            cryptotext = `<pre>${cryptotext}</pre>`;
            this.setState({
              currentlyEncrypted: true,
              plaintext,
              cryptotext
            });
            return this.props.session.changes.add({ body: cryptotext });
          }
        }
      );
    }
  }

  _encrypt(text, identities, cb) {
    // get the actual key objects
    const keys = _.pluck(identities, "key");
    // remove the nulls
    const kms = _.compact(keys);
    if (kms.length === 0) {
      AppEnv.showErrorDialog(`There are no PGP public keys loaded, so the message cannot be \
encrypted. Compose a message, add recipients in the To: field, and try again.`);
      return;
    }
    const params = {
      encrypt_for: kms,
      msg: text
    };
    return pgp.box(params, cb);
  }

  _checkKeysAndEncrypt(text, identities, cb) {
    const emails = _.chain(identities)
      .pluck("addresses")
      .flatten()
      .uniq()
      .value();

    if (_.every(identities, identity => identity.key != null)) {
      // every key is present and valid
      return this._encrypt(text, identities, cb);
    } else {
      // open a popover to correct null keys
      return DatabaseStore.findAll(Contact, { email: emails }).then(
        contacts => {
          const component = (
            <ModalKeyRecommender
              contacts={contacts}
              emails={emails}
              callback={newIdentities => this._encrypt(text, newIdentities, cb)}
            />
          );
          return Actions.openPopover(component, {
            originRect: ReactDOM.findDOMNode(this).getBoundingClientRect(),
            direction: "up",
            closeOnAppBlur: false
          });
        }
      );
    }
  }
}
EncryptMessageButton.initClass();

module.exports = EncryptMessageButton;
