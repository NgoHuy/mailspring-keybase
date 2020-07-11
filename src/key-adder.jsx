/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let KeyAdder;
const { Utils, React, RegExpUtils } = require("mailspring-exports");
const { RetinaImg } = require("mailspring-component-kit");
const PGPKeyStore = require("./pgp-key-store");
const Identity = require("./identity");
const kb = require("./keybase");
const pgp = require("kbpgp");
const _ = require("underscore");
const fs = require("fs");

module.exports = KeyAdder = (function() {
  KeyAdder = class KeyAdder extends React.Component {
    static displayName = "KeyAdder";
    

    constructor(props) {
      super();
      this._onPasteButtonClick = this._onPasteButtonClick.bind(this);
      this._onGenerateButtonClick = this._onGenerateButtonClick.bind(this);
      this._onImportButtonClick = this._onImportButtonClick.bind(this);
      this._onInnerGenerateButtonClick = this._onInnerGenerateButtonClick.bind(
        this
      );
      this._generateKeypair = this._generateKeypair.bind(this);
      this._saveNewKey = this._saveNewKey.bind(this);
      this._onAddressChange = this._onAddressChange.bind(this);
      this._onPassphraseChange = this._onPassphraseChange.bind(this);
      this._onKeyChange = this._onKeyChange.bind(this);
      this.state = {
        address: "",
        keyContents: "",
        passphrase: "",

        generate: false,
        paste: false,
        import: false,

        isPriv: false,
        loading: false,

        validAddress: false,
        validKeyBody: false
      };
    }

    _onPasteButtonClick(event) {
      return this.setState({
        generate: false,
        paste: !this.state.paste,
        import: false,
        address: "",
        validAddress: false,
        keyContents: ""
      });
    }

    _onGenerateButtonClick(event) {
      return this.setState({
        generate: !this.state.generate,
        paste: false,
        import: false,
        address: "",
        validAddress: false,
        keyContents: "",
        passphrase: ""
      });
    }

    _onImportButtonClick(event) {
      return AppEnv.showOpenDialog(
        {
          title: "Import PGP Key",
          buttonLabel: "Import",
          properties: ["openFile"]
        },
        filepath => {
          if (filepath != null) {
            this.setState({
              generate: false,
              paste: false,
              import: true,
              address: "",
              validAddress: false,
              passphrase: ""
            });
            return fs.readFile(filepath[0], (err, data) => {
              return pgp.KeyManager.import_from_armored_pgp(
                {
                  armored: data
                },
                (err, km) => {
                  if (err) {
                    PGPKeyStore._displayError("File is not a valid PGP key.");
                    return;
                  } else {
                    const privateStart =
                      "-----BEGIN PGP PRIVATE KEY BLOCK-----";
                    const keyBody =
                      km.armored_pgp_private != null
                        ? km.armored_pgp_private
                        : km.armored_pgp_public;
                    return this.setState({
                      keyContents: keyBody,
                      isPriv: keyBody.indexOf(privateStart) >= 0,
                      validKeyBody: true
                    });
                  }
                }
              );
            });
          }
        }
      );
    }

    _onInnerGenerateButtonClick(event) {
      this.setState({
        loading: true
      });
      return this._generateKeypair();
    }

    _generateKeypair() {
      return pgp.KeyManager.generate_rsa(
        { userid: this.state.address },
        (err, km) => {
          return km.sign({}, err => {
            if (err) {
              console.warn(err);
            }
            km.export_pgp_private(
              { passphrase: this.state.passphrase },
              (err, pgp_private) => {
                const ident = new Identity({
                  addresses: [this.state.address],
                  isPriv: true
                });
                return PGPKeyStore.saveNewKey(ident, pgp_private);
              }
            );
            return km.export_pgp_public({}, (err, pgp_public) => {
              const ident = new Identity({
                addresses: [this.state.address],
                isPriv: false
              });
              PGPKeyStore.saveNewKey(ident, pgp_public);
              return this.setState({
                keyContents: pgp_public,
                loading: false
              });
            });
          });
        }
      );
    }

    _saveNewKey() {
      const ident = new Identity({
        addresses: [this.state.address],
        isPriv: this.state.isPriv
      });
      return PGPKeyStore.saveNewKey(ident, this.state.keyContents);
    }

    _onAddressChange(event) {
      const address = event.target.value;
      let valid = false;
      if (
        address &&
        address.length > 0 &&
        RegExpUtils.emailRegex().test(address)
      ) {
        valid = true;
      }
      return this.setState({
        address: event.target.value,
        validAddress: valid
      });
    }

    _onPassphraseChange(event) {
      return this.setState({
        passphrase: event.target.value
      });
    }

    _onKeyChange(event) {
      const privateStart = "-----BEGIN PGP PRIVATE KEY BLOCK-----";
      this.setState({
        keyContents: event.target.value,
        isPriv: event.target.value.indexOf(privateStart) >= 0
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
            valid = true;
          }
          return this.setState({
            validKeyBody: valid
          });
        }
      );
    }

    _renderAddButtons() {
      return (
        <div>
          {`\
Add a PGP Key:\
`}
          <button
            className="btn key-creation-button"
            title="Paste"
            onClick={this._onPasteButtonClick}
          >
            Paste in a New Key
          </button>
          <button
            className="btn key-creation-button"
            title="Import"
            onClick={this._onImportButtonClick}
          >
            Import a Key From File
          </button>
          <button
            className="btn key-creation-button"
            title="Generate"
            onClick={this._onGenerateButtonClick}
          >
            Generate a New Keypair
          </button>
        </div>
      );
    }

    _renderManualKey() {
      let invalidMsg;
      if (!this.state.validAddress && this.state.address.length > 0) {
        invalidMsg = <span className="invalid-msg">Invalid email address</span>;
      } else if (
        !this.state.validKeyBody &&
        this.state.keyContents.length > 0
      ) {
        invalidMsg = <span className="invalid-msg">Invalid key body</span>;
      } else {
        invalidMsg = <span className="invalid-msg"> </span>;
      }
      const invalidInputs = !(
        this.state.validAddress && this.state.validKeyBody
      );

      const buttonClass = invalidInputs
        ? "btn key-add-btn btn-disabled"
        : "btn key-add-btn";

      const passphraseInput = (
        <input
          type="password"
          value={this.state.passphrase}
          placeholder="Private Key Password"
          className="key-passphrase-input"
          onChange={this._onPassphraseChange}
        />
      );

      return (
        <div className="key-adder">
          <div className="key-text">
            <textarea
              ref="key-input"
              value={this.state.keyContents || ""}
              onChange={this._onKeyChange}
              placeholder="Paste in your PGP key here!"
            />
          </div>
          <div className="credentials">
            <input
              type="text"
              value={this.state.address}
              placeholder="Email Address"
              className="key-email-input"
              onChange={this._onAddressChange}
            />
            {this.state.isPriv ? passphraseInput : undefined}
            {invalidMsg}
            <button
              className={buttonClass}
              disabled={invalidInputs}
              title="Save"
              onClick={this._saveNewKey}
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    _renderGenerateKey() {
      let invalidMsg, keyPlaceholder;
      if (!this.state.validAddress && this.state.address.length > 0) {
        invalidMsg = <span className="invalid-msg">Invalid email address</span>;
      } else {
        invalidMsg = <span className="invalid-msg"> </span>;
      }

      const loading = (
        <RetinaImg
          style={{ width: 20, height: 20 }}
          name="inline-loading-spinner.gif"
          mode={RetinaImg.Mode.ContentPreserve}
        />
      );
      if (this.state.loading) {
        keyPlaceholder = "Generating your key now. This could take a while.";
      } else {
        keyPlaceholder =
          "Your generated public key will appear here. Share it with your friends!";
      }

      const buttonClass = !this.state.validAddress
        ? "btn key-add-btn btn-disabled"
        : "btn key-add-btn";

      return (
        <div className="key-adder">
          <div className="credentials">
            <input
              type="text"
              value={this.state.address}
              placeholder="Email Address"
              className="key-email-input"
              onChange={this._onAddressChange}
            />
            <input
              type="password"
              value={this.state.passphrase}
              placeholder="Private Key Password"
              className="key-passphrase-input"
              onChange={this._onPassphraseChange}
            />
            {invalidMsg}
            <button
              className={buttonClass}
              disabled={!this.state.validAddress}
              title="Generate"
              onClick={this._onInnerGenerateButtonClick}
            >
              Generate
            </button>
          </div>
          <div className="key-text">
            <div className="loading">
              {this.state.loading ? loading : undefined}
            </div>
            <textarea
              ref="key-output"
              value={this.state.keyContents || ""}
              disabled={true}
              placeholder={keyPlaceholder}
            />
          </div>
        </div>
      );
    }

    render() {
      return (
        <div>
          {this._renderAddButtons()}
          {this.state.generate ? this._renderGenerateKey() : undefined}
          {this.state.paste || this.state.import
            ? this._renderManualKey()
            : undefined}
        </div>
      );
    }
  };
  return KeyAdder;
})();
