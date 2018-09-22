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
let ModalKeyRecommender;
const { Utils, React, Actions } = require("mailspring-exports");
const PGPKeyStore = require("./pgp-key-store");
const KeybaseSearch = require("./keybase-search");
const KeybaseUser = require("./keybase-user");
const kb = require("./keybase");
const _ = require("underscore");
import PropTypes from 'prop-types';
//import {Component} from 'react';

module.exports = ModalKeyRecommender = (function() {
  ModalKeyRecommender = class ModalKeyRecommender extends React.Component {
    static displayName = "ModalKeyRecommender";
    static initClass() {
      this.propTypes = {
        contacts: PropTypes.array.isRequired,
        emails: PropTypes.array,
        callback: PropTypes.func
      };

      this.defaultProps = { callback() {} };
      // NOP
    }

    constructor(props) {
      super(props);
      this._onKeystoreChange = this._onKeystoreChange.bind(this);
      this._getStateFromStores = this._getStateFromStores.bind(this);
      this._selectProfile = this._selectProfile.bind(this);
      this._onNext = this._onNext.bind(this);
      this._onPrev = this._onPrev.bind(this);
      this._setPage = this._setPage.bind(this);
      this._onDone = this._onDone.bind(this);
      this._onManageKeys = this._onManageKeys.bind(this);
      this.state = Object.assign(
        {
          currentContact: 0
        },
        this._getStateFromStores()
      );
    }

    componentDidMount() {
      return (this.unlistenKeystore = PGPKeyStore.listen(
        this._onKeystoreChange
      ));
    }

    componentWillUnmount() {
      return this.unlistenKeystore();
    }

    _onKeystoreChange() {
      return this.setState(this._getStateFromStores());
    }

    _getStateFromStores() {
      return { identities: PGPKeyStore.pubKeys(this.props.emails) };
    }

    _selectProfile(address, identity) {
      // TODO this is an almost exact duplicate of keybase-search.cjsx:_save
      const keybaseUsername = identity.keybase_profile.components.username.val;
      identity.addresses.push(address);
      return kb.getKey(keybaseUsername, (error, key) => {
        if (error) {
          return console.error(error);
        } else {
          return PGPKeyStore.saveNewKey(identity, key);
        }
      });
    }

    _onNext() {
      // NOTE: this doesn't do bounds checks! you must do that in render()!
      return this.setState({ currentContact: this.state.currentContact + 1 });
    }

    _onPrev() {
      // NOTE: this doesn't do bounds checks! you must do that in render()!
      return this.setState({ currentContact: this.state.currentContact - 1 });
    }

    _setPage(page) {
      // NOTE: this doesn't do bounds checks! you must do that in render()!
      return this.setState({ currentContact: page });
    }
    // indexes from 0 because what kind of monster doesn't

    _onDone() {
      if (this.state.identities.length < this.props.emails.length) {
        if (
          !PGPKeyStore._displayDialog(
            "Encrypt without keys for all recipients?",
            "Some recipients are missing PGP public keys. They will not be able to decrypt this message.",
            ["Encrypt", "Cancel"]
          )
        ) {
          return;
        }
      }

      const emptyIdents = _.filter(
        this.state.identities,
        identity => identity.key == null
      );
      if (emptyIdents.length === 0) {
        Actions.closePopover();
        return this.props.callback(this.state.identities);
      } else {
        const newIdents = [];
        return (() => {
          const result = [];
          for (let idIndex in emptyIdents) {
            const identity = emptyIdents[idIndex];
            if (idIndex < emptyIdents.length - 1) {
              result.push(
                PGPKeyStore.getKeyContents({
                  key: identity,
                  callback: identity => newIdents.push(identity)
                })
              );
            } else {
              result.push(
                PGPKeyStore.getKeyContents({
                  key: identity,
                  callback: identity => {
                    newIdents.push(identity);
                    this.props.callback(newIdents);
                    return Actions.closePopover();
                  }
                })
              );
            }
          }
          return result;
        })();
      }
    }

    _onManageKeys() {
      Actions.switchPreferencesTab("Encryption");
      return Actions.openPreferences();
    }

    render() {
      // find the email we're dealing with now
      let backButton, body, nextButton;
      const email = this.props.emails[this.state.currentContact];
      // and a corresponding contact
      const contact = _.findWhere(this.props.contacts, { email: email });
      const contactString = contact != null ? contact.toString() : email;
      // find the identity object that goes with this email (if any)
      const identity = _.find(this.state.identities, identity =>
        Array.from(identity.addresses).includes(email)
      );

      if (this.state.currentContact === this.props.emails.length - 1) {
        // last one
        if (this.props.emails.length === 1) {
          // only one
          backButton = false;
        } else {
          backButton = (
            <button className="btn modal-back-button" onClick={this._onPrev}>
              Back
            </button>
          );
        }
        nextButton = (
          <button className="btn modal-next-button" onClick={this._onDone}>
            Done
          </button>
        );
      } else if (this.state.currentContact === 0) {
        // first one
        backButton = false;
        nextButton = (
          <button className="btn modal-next-button" onClick={this._onNext}>
            Next
          </button>
        );
      } else {
        // somewhere in the middle
        backButton = (
          <button className="btn modal-back-button" onClick={this._onPrev}>
            Back
          </button>
        );
        nextButton = (
          <button className="btn modal-next-button" onClick={this._onNext}>
            Next
          </button>
        );
      }

      if (identity != null) {
        const deleteButton = (
          <button
            title="Delete Public"
            className="btn btn-toolbar btn-danger"
            onClick={() => PGPKeyStore.deleteKey(identity)}
            ref="button"
          >{`\
Delete Key\
`}</button>
        );
        body = [
          <div key="title" className="picker-title">
            This PGP public key has been saved for <br />
            <b>{contactString}.</b>
          </div>,
          <div className="keybase-profile-solo">
            <KeybaseUser
              key="keybase-user"
              profile={identity}
              displayEmailList={false}
              actionButton={deleteButton}
            />
          </div>
        ];
      } else {
        let query;
        if (contact != null) {
          query = contact.fullName();
          // don't search Keybase for emails, won't work anyways
          if (query.match(/\s/) == null) {
            query = "";
          }
        } else {
          query = "";
        }
        const importFunc = identity => this._selectProfile(email, identity);

        body = [
          <div key="title" className="picker-title">
            There is no PGP public key saved for <br />
            <b>{contactString}.</b>
          </div>,
          <KeybaseSearch
            key="keybase-search"
            initialSearch={query}
            importFunc={importFunc}
          />
        ];
      }

      const prefsButton = (
        <button className="btn modal-prefs-button" onClick={this._onManageKeys}>
          Advanced Key Management
        </button>
      );

      return (
        <div className="key-picker-modal">
          {body}
          <div style={{ flex: 1 }} />
          <div className="picker-controls">
            <div style={{ width: 60 }}> {backButton} </div>
            {prefsButton}
            <div style={{ width: 60 }}> {nextButton} </div>
          </div>
        </div>
      );
    }
  };
  ModalKeyRecommender.initClass();
  return ModalKeyRecommender;
})();
