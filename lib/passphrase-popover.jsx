/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let PassphrasePopover;
const { React, Actions } = require("mailspring-exports");
const Identity = require("./identity");
const PGPKeyStore = require("./pgp-key-store");
const _ = require("underscore");
const fs = require("fs");
const pgp = require("kbpgp");
import PropTypes from 'prop-types';

module.exports = PassphrasePopover = (function() {
  PassphrasePopover = class PassphrasePopover extends React.Component {
    static initClass() {
      this.propTypes = {
        identity: PropTypes.instanceOf(Identity),
        addresses: PropTypes.array
      };
    }
    constructor() {
      super(props);
      this._onPassphraseChange = this._onPassphraseChange.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._validatePassphrase = this._validatePassphrase.bind(this);
      this._onDone = this._onDone.bind(this);
      this.state = {
        passphrase: "",
        placeholder: "PGP private key password",
        error: false,
        mounted: true
      };
    }

    componentDidMount() {
      return (this._mounted = true);
    }

    componentWillUnmount() {
      return (this._mounted = false);
    }

    render() {
      const classNames = this.state.error
        ? "key-passphrase-input form-control bad-passphrase"
        : "key-passphrase-input form-control";
      return (
        <div className="passphrase-popover">
          <input
            type="password"
            value={this.state.passphrase}
            placeholder={this.state.placeholder}
            className={classNames}
            onChange={this._onPassphraseChange}
            onKeyUp={this._onKeyUp}
          />
          <button
            className="btn btn-toolbar"
            onClick={this._validatePassphrase}
          >
            Done
          </button>
        </div>
      );
    }

    _onPassphraseChange(event) {
      return this.setState({
        passphrase: event.target.value,
        placeholder: "PGP private key password",
        error: false
      });
    }

    _onKeyUp(event) {
      if (event.keyCode === 13) {
        return this._validatePassphrase();
      }
    }

    _validatePassphrase() {
      const { passphrase } = this.state;
      return (() => {
        const result = [];
        for (var emailIndex in this.props.addresses) {
          const email = this.props.addresses[emailIndex];
          var privateKeys = PGPKeyStore.privKeys({
            address: email,
            timed: false
          });
          result.push(
            (() => {
              const result1 = [];
              for (var keyIndex in privateKeys) {
                // check to see if the password unlocks the key
                const key = privateKeys[keyIndex];
                result1.push(
                  fs.readFile(key.keyPath, (err, data) => {
                    return pgp.KeyManager.import_from_armored_pgp(
                      {
                        armored: data
                      },
                      (err, km) => {
                        if (err) {
                          return console.warn(err);
                        } else {
                          return km.unlock_pgp({ passphrase }, err => {
                            if (err) {
                              if (
                                parseInt(keyIndex, 10) ===
                                privateKeys.length - 1
                              ) {
                                if (
                                  parseInt(emailIndex, 10) ===
                                  this.props.addresses.length - 1
                                ) {
                                  // every key has been tried, the password failed on all of them
                                  if (this._mounted) {
                                    return this.setState({
                                      passphrase: "",
                                      placeholder: "Incorrect password",
                                      error: true
                                    });
                                  }
                                }
                              }
                            } else {
                              // the password unlocked a key; that key should be used
                              return this._onDone();
                            }
                          });
                        }
                      }
                    );
                  })
                );
              }
              return result1;
            })()
          );
        }
        return result;
      })();
    }

    _onDone() {
      if (this.props.identity != null) {
        this.props.onPopoverDone(this.state.passphrase, this.props.identity);
      } else {
        this.props.onPopoverDone(this.state.passphrase);
      }
      return Actions.closePopover();
    }
  };
  PassphrasePopover.initClass();
  return PassphrasePopover;
})();
