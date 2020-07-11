/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
  MessageStore,
  React,
  ReactDOM,
  AttachmentStore,
  MessageBodyProcessor,
  Actions
} = require("mailspring-exports");
const PGPKeyStore = require("./pgp-key-store");
const { remote } = require("electron");
const PassphrasePopover = require("./passphrase-popover");
const PrivateKeyPopover = require("./private-key-popover");
const pgp = require("kbpgp");
const _ = require("underscore");
import PropTypes from 'prop-types';

class DecryptMessageButton extends React.Component {
  static displayName = "DecryptMessageButton";
  static initClass() {
    this.propTypes = { message: PropTypes.object.isRequired };
  }

  constructor(props) {
    super(props);
    this._onClickDecrypt = this._onClickDecrypt.bind(this);
    this._onClickDecryptAttachments = this._onClickDecryptAttachments.bind(
      this
    );
    this.decryptPopoverDone = this.decryptPopoverDone.bind(this);
    this.decryptAttachmentsPopoverDone = this.decryptAttachmentsPopoverDone.bind(
      this
    );
    this._openPassphrasePopover = this._openPassphrasePopover.bind(this);
    this._noPrivateKeys = this._noPrivateKeys.bind(this);
    this.render = this.render.bind(this);
    this.state = this._getStateFromStores();
  }

  _getStateFromStores() {
    return {
      isDecrypted: PGPKeyStore.isDecrypted(this.props.message),
      wasEncrypted: PGPKeyStore.hasEncryptedComponent(this.props.message),
      encryptedAttachments: PGPKeyStore.fetchEncryptedAttachments(
        this.props.message
      ),
      status: PGPKeyStore.msgStatus(this.props.message)
    };
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

  _onKeystoreChange() {
    // every time a new key gets unlocked/fetched, try to decrypt this message
    if (!this.state.isDecrypted) {
      PGPKeyStore.decrypt(this.props.message);
    }
    return this.setState(this._getStateFromStores());
  }

  _onClickDecrypt(event) {
    const popoverTarget = event.target.getBoundingClientRect();
    if (this._noPrivateKeys()) {
      return Actions.openPopover(
        <PrivateKeyPopover
          addresses={_.pluck(this.props.message.to, "email")}
          callback={() =>
            this._openPassphrasePopover(popoverTarget, this.decryptPopoverDone)
          }
        />,
        { originRect: popoverTarget, direction: "down" }
      );
    } else {
      return this._openPassphrasePopover(
        popoverTarget,
        this.decryptPopoverDone
      );
    }
  }

  _displayError(err) {
    const { dialog } = remote;
    return dialog.showErrorBox("Decryption Error", err.toString());
  }

  _onClickDecryptAttachments(event) {
    const popoverTarget = event.target.getBoundingClientRect();
    if (this._noPrivateKeys()) {
      return Actions.openPopover(
        <PrivateKeyPopover
          addresses={_.pluck(this.props.message.to, "email")}
          callback={() =>
            this._openPassphrasePopover(
              popoverTarget,
              this.decryptAttachmentsPopoverDone
            )
          }
        />,
        { originRect: popoverTarget, direction: "down" }
      );
    } else {
      return this._openPassphrasePopover(
        popoverTarget,
        this.decryptAttachmentsPopoverDone
      );
    }
  }

  decryptPopoverDone(passphrase) {
    return (() => {
      const result = [];
      for (let recipient of Array.from(this.props.message.to)) {
        // right now, just try to unlock all possible keys
        // (many will fail - TODO?)
        const privateKeys = PGPKeyStore.privKeys({
          address: recipient.email,
          timed: false
        });
        result.push(
          Array.from(privateKeys).map(privateKey =>
            PGPKeyStore.getKeyContents({ key: privateKey, passphrase })
          )
        );
      }
      return result;
    })();
  }

  decryptAttachmentsPopoverDone(passphrase) {
    return (() => {
      const result = [];
      for (let recipient of Array.from(this.props.message.to)) {
        const privateKeys = PGPKeyStore.privKeys({
          address: recipient.email,
          timed: false
        });
        result.push(
          Array.from(privateKeys).map(privateKey =>
            PGPKeyStore.getKeyContents({
              key: privateKey,
              passphrase,
              callback: identity =>
                PGPKeyStore.decryptAttachments(
                  identity,
                  this.state.encryptedAttachments
                )
            })
          )
        );
      }
      return result;
    })();
  }

  _openPassphrasePopover(target, callback) {
    return Actions.openPopover(
      <PassphrasePopover
        addresses={_.pluck(this.props.message.to, "email")}
        onPopoverDone={callback}
      />,
      { originRect: target, direction: "down" }
    );
  }

  _noPrivateKeys() {
    let numKeys = 0;
    for (let recipient of Array.from(this.props.message.to)) {
      numKeys =
        numKeys +
        PGPKeyStore.privKeys({ address: recipient.email, timed: false }).length;
    }
    return numKeys < 1;
  }

  render() {
    let decryptionInterface;
    if (
      !(this.state.wasEncrypted || this.state.encryptedAttachments.length > 0)
    ) {
      return false;
    }

    let title = "Message Encrypted";
    let decryptLabel = "Decrypt";
    let borderClass = "border";
    let decryptClass = "decrypt-bar";
    if (this.state.status != null) {
      if (this.state.status.indexOf("Message decrypted") >= 0) {
        title = this.state.status;
        borderClass = "border done-border";
        decryptClass = "decrypt-bar done-decrypt-bar";
      } else if (this.state.status.indexOf("Unable to decrypt message.") >= 0) {
        title = this.state.status;
        borderClass = "border error-border";
        decryptClass = "decrypt-bar error-decrypt-bar";
        decryptLabel = "Try Again";
      }
    }

    let decryptBody = false;
    if (
      !this.state.isDecrypted &&
      !(
        (this.state.status != null
          ? this.state.status.indexOf("malformed")
          : undefined) >= 0
      )
    ) {
      decryptBody = (
        <button
          title="Decrypt email body"
          className="btn btn-toolbar"
          onClick={this._onClickDecrypt}
          ref="button"
        >
          {decryptLabel}
        </button>
      );
    }

    let decryptAttachments = false;
    if (
      (this.state.encryptedAttachments != null
        ? this.state.encryptedAttachments.length
        : undefined) >= 1
    ) {
      title =
        this.state.encryptedAttachments.length === 1
          ? "Attachment Encrypted"
          : "Attachments Encrypted";
      const buttonLabel =
        this.state.encryptedAttachments.length === 1
          ? "Decrypt Attachment"
          : "Decrypt Attachments";
      decryptAttachments = (
        <button
          onClick={this._onClickDecryptAttachments}
          className="btn btn-toolbar"
        >
          {buttonLabel}
        </button>
      );
    }

    if (decryptAttachments || decryptBody) {
      decryptionInterface = (
        <div className="decryption-interface">
          {decryptBody}
          {decryptAttachments}
        </div>
      );
    }

    return (
      <div className="keybase-decrypt">
        <div className="line-w-label">
          <div className={borderClass} />
          <div className={decryptClass}>
            <div className="title-text">{title}</div>
            {decryptionInterface}
          </div>
          <div className={borderClass} />
        </div>
      </div>
    );
  }
}
DecryptMessageButton.initClass();

module.exports = DecryptMessageButton;
