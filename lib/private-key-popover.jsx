/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let PrivateKeyPopover;
const { React, Actions, AccountStore } = require("mailspring-exports");
const { remote } = require("electron");
const Identity = require("./identity");
const PGPKeyStore = require("./pgp-key-store");
const PassphrasePopover = require("./passphrase-popover");
const _ = require("underscore");
const fs = require("fs");
const pgp = require("kbpgp");
import PropTypes from 'prop-types';

module.exports = PrivateKeyPopover = (function() {
  PrivateKeyPopover = class PrivateKeyPopover extends React.Component {
    static initClass() {
      this.propTypes = { addresses: PropTypes.array };
    }
    constructor() {
      super();
      this.render = this.render.bind(this);
      this._renderAddresses = this._renderAddresses.bind(this);
      this._onSelectAddress = this._onSelectAddress.bind(this);
      this._onClickAdvanced = this._onClickAdvanced.bind(this);
      this._onClickImport = this._onClickImport.bind(this);
      this._onClickPaste = this._onClickPaste.bind(this);
      this._onKeyChange = this._onKeyChange.bind(this);
      this._onDone = this._onDone.bind(this);
      this._onKeySaved = this._onKeySaved.bind(this);
      this.state = {
        selectedAddress: "0",
        keyBody: "",
        paste: false,
        import: false,
        validKeyBody: false
      };
    }

    render() {
      const errorBar = (
        <div className="invalid-key-body">Invalid key body.</div>
      );
      const keyArea = (
        <textarea
          value={this.state.keyBody || ""}
          onChange={this._onKeyChange}
          placeholder="Paste in your PGP key here!"
        />
      );

      const saveBtnClass = !this.state.validKeyBody
        ? "btn modal-done-button btn-disabled"
        : "btn modal-done-button";
      const saveButton = (
        <button
          className={saveBtnClass}
          disabled={!this.state.validKeyBody}
          onClick={this._onDone}
        >
          Save
        </button>
      );

      return (
        <div className="private-key-popover" tabIndex={0}>
          <span key="title" className="picker-title">
            <b>
              No PGP private key found.<br />Add a key for{" "}
              {this._renderAddresses()}
            </b>
          </span>
          <div className="key-add-buttons">
            <button
              className="btn btn-toolbar paste-btn"
              onClick={this._onClickPaste}
            >
              Paste in a Key
            </button>
            <button
              className="btn btn-toolbar import-btn"
              onClick={this._onClickImport}
            >
              Import from File
            </button>
          </div>
          {(this.state.import || this.state.paste) &&
          !this.state.validKeyBody &&
          this.state.keyBody !== ""
            ? errorBar
            : undefined}
          {this.state.import || this.state.paste ? keyArea : undefined}
          <div className="picker-controls">
            <div style={{ width: 80 }}>
              <button
                className="btn modal-cancel-button"
                onClick={() => Actions.closePopover()}
              >
                Cancel
              </button>
            </div>
            <button
              className="btn modal-prefs-button"
              onClick={this._onClickAdvanced}
            >
              Advanced
            </button>
            <div style={{ width: 80 }}>{saveButton}</div>
          </div>
        </div>
      );
    }

    _renderAddresses() {
      let addresses;
      const signedIn = _.pluck(AccountStore.accounts(), "emailAddress");
      const suggestions = _.intersection(signedIn, this.props.addresses);

      if (suggestions.length === 1) {
        return (addresses = <span>{suggestions[0]}.</span>);
      } else if (suggestions.length > 1) {
        const options = suggestions.map(address => (
          <option
            value={suggestions.indexOf(address)}
            key={suggestions.indexOf(address)}
          >
            {address}
          </option>
        ));
        return (addresses = (
          <select
            value={this.state.selectedAddress}
            onChange={this._onSelectAddress}
            style={{ minWidth: 150 }}
          >
            {options}
          </select>
        ));
      } else {
        throw new Error(
          "How did you receive a message that you're not in the TO field for?"
        );
      }
    }

    _onSelectAddress(event) {
      return this.setState({
        selectedAddress: parseInt(event.target.value, 10)
      });
    }

    _displayError(err) {
      const { dialog } = remote;
      return dialog.showErrorBox("Private Key Error", err.toString());
    }

    _onClickAdvanced() {
      Actions.switchPreferencesTab("Encryption");
      return Actions.openPreferences();
    }

    _onClickImport(event) {
      return AppEnv.showOpenDialog(
        {
          title: "Import PGP Key",
          buttonLabel: "Import",
          properties: ["openFile"]
        },
        filepath => {
          if (filepath != null) {
            return fs.readFile(filepath[0], (err, data) => {
              return pgp.KeyManager.import_from_armored_pgp(
                {
                  armored: data
                },
                (err, km) => {
                  if (err) {
                    this._displayError("File is not a valid PGP private key.");
                    return;
                  } else {
                    const privateStart =
                      "-----BEGIN PGP PRIVATE KEY BLOCK-----";
                    if (km.armored_pgp_public.indexOf(privateStart) >= 0) {
                      return this.setState({
                        paste: false,
                        import: true,
                        keyBody: km.armored_pgp_public,
                        validKeyBody: true
                      });
                    } else {
                      return this._displayError(
                        "File is not a valid PGP private key."
                      );
                    }
                  }
                }
              );
            });
          }
        }
      );
    }

    _onClickPaste(event) {
      return this.setState({
        paste: !this.state.paste,
        import: false,
        keyBody: "",
        validKeyBody: false
      });
    }

    _onKeyChange(event) {
      this.setState({
        keyBody: event.target.value
      });
      return pgp.KeyManager.import_from_armored_pgp(
        {
          armored: event.target.value
        },
        (err, km) => {
          let valid;
          if (err) {
            valid = false;
          } else {
            const privateStart = "-----BEGIN PGP PRIVATE KEY BLOCK-----";
            if (km.armored_pgp_public.indexOf(privateStart) >= 0) {
              valid = true;
            } else {
              valid = false;
            }
          }
          return this.setState({
            validKeyBody: valid
          });
        }
      );
    }

    _onDone() {
      const signedIn = _.pluck(AccountStore.accounts(), "emailAddress");
      const suggestions = _.intersection(signedIn, this.props.addresses);
      const selectedAddress = suggestions[this.state.selectedAddress];
      const ident = new Identity({
        addresses: [selectedAddress],
        isPriv: true
      });
      this.unlistenKeystore = PGPKeyStore.listen(this._onKeySaved, this);
      return PGPKeyStore.saveNewKey(ident, this.state.keyBody);
    }

    _onKeySaved() {
      this.unlistenKeystore();
      Actions.closePopover();
      return this.props.callback();
    }
  };
  PrivateKeyPopover.initClass();
  return PrivateKeyPopover;
})();
