/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let KeybaseUser;
const { Utils, React, Actions } = require("mailspring-exports");
const { ParticipantsTextField } = require("mailspring-component-kit");
const PGPKeyStore = require("./pgp-key-store");
const EmailPopover = require("./email-popover");
const Identity = require("./identity");
const kb = require("./keybase");
const _ = require("underscore");
import PropTypes from 'prop-types';

module.exports = KeybaseUser = (function() {
  KeybaseUser = class KeybaseUser extends React.Component {
    static displayName = "KeybaseUserProfile";
    static initClass() {
      this.propTypes = {
        profile: PropTypes.instanceOf(Identity).isRequired,
        actionButton: PropTypes.node,
        displayEmailList: PropTypes.bool
      };

      this.defaultProps = {
        actionButton: false,
        displayEmailList: true
      };
    }

    constructor(props) {
      super(props);
      this._addEmail = this._addEmail.bind(this);
      this._addEmailClick = this._addEmailClick.bind(this);
      this._popoverDone = this._popoverDone.bind(this);
      this._removeEmail = this._removeEmail.bind(this);
      this.render = this.render.bind(this);
    }

    componentDidMount() {
      return PGPKeyStore.getKeybaseData(this.props.profile);
    }

    _addEmail(email) {
      return PGPKeyStore.addAddressToKey(this.props.profile, email);
    }

    _addEmailClick(event) {
      const popoverTarget = event.target.getBoundingClientRect();

      return Actions.openPopover(
        <EmailPopover
          profile={this.props.profile}
          onPopoverDone={this._popoverDone}
        />,
        { originRect: popoverTarget, direction: "left" }
      );
    }

    _popoverDone(addresses, identity) {
      if (addresses.length < 1) {
        // no email addresses added, noop
        return;
      } else {
        return _.each(addresses, address => {
          return this._addEmail(address);
        });
      }
    }

    _removeEmail(email) {
      return PGPKeyStore.removeAddressFromKey(this.props.profile, email);
    }

    render() {
      let abv, bgColor, emailList, hue, picture;
      const { profile } = this.props;

      let keybaseDetails = <div className="details" />;
      if (profile.keybase_profile != null) {
        let fullname, keybase_string, username;
        const keybase = profile.keybase_profile;

        // profile picture
        if (keybase.thumbnail != null) {
          picture = <img className="user-picture" src={keybase.thumbnail} />;
        } else {
          hue = Utils.hueForString("Keybase");
          bgColor = `hsl(${hue}, 50%, 45%)`;
          abv = "K";
          picture = (
            <div
              className="default-profile-image"
              style={{ backgroundColor: bgColor }}
            >
              {abv}
            </div>
          );
        }

        // full name
        if (
          (keybase.components.full_name != null
            ? keybase.components.full_name.val
            : undefined) != null
        ) {
          fullname = keybase.components.full_name.val;
        } else {
          fullname = username;
          username = false;
        }

        // link to keybase profile
        const keybase_url = `keybase.io/${keybase.components.username.val}`;
        if (keybase_url.length > 25) {
          keybase_string = keybase_url.slice(0, 23).concat("...");
        } else {
          keybase_string = keybase_url;
        }
        username = <a href={`https://${keybase_url}`}>{keybase_string}</a>;

        // TODO: potentially display confirmation on keybase-user objects
        /*
        possible_profiles = ["twitter", "github", "coinbase"]
        profiles = _.map(possible_profiles, (possible) =>
          if keybase.components[possible]?.val?
            * TODO icon instead of weird "service: username" text
            return (<span key={ possible }><b>{ possible }</b>: { keybase.components[possible].val }</span>)
        )
        profiles = _.reject(profiles, (profile) -> profile is undefined)
         profiles =  _.map(profiles, (profile) ->
          return <span key={ profile.key }>{ profile } </span>)
        profileList = (<span>{ profiles }</span>)
        */

        keybaseDetails = (
          <div className="details">
            <div className="profile-name">{fullname}</div>
            <div className="profile-username">{username}</div>
          </div>
        );
      } else {
        // if no keybase profile, default image is based on email address
        hue = Utils.hueForString(this.props.profile.addresses[0]);
        bgColor = `hsl(${hue}, 50%, 45%)`;
        abv = this.props.profile.addresses[0][0].toUpperCase();
        picture = (
          <div
            className="default-profile-image"
            style={{ backgroundColor: bgColor }}
          >
            {abv}
          </div>
        );
      }

      // email addresses
      if (
        (profile.addresses != null ? profile.addresses.length : undefined) > 0
      ) {
        const emails = _.map(profile.addresses, email => {
          // TODO make that remove button not terrible
          return (
            <li key={email}>
              {email}{" "}
              <small>
                <a onClick={() => this._removeEmail(email)}>(X)</a>
              </small>
            </li>
          );
        });
        emailList = (
          <ul>
            {" "}
            {emails}
            <a ref="addEmail" onClick={this._addEmailClick}>
              + Add Email
            </a>
          </ul>
        );
      }

      const emailListDiv = (
        <div className="email-list">
          <ul>{emailList}</ul>
        </div>
      );

      return (
        <div className="keybase-profile">
          <div className="profile-photo-wrap">
            <div className="profile-photo">{picture}</div>
          </div>
          {keybaseDetails}
          {this.props.displayEmailList ? emailListDiv : undefined}
          {this.props.actionButton}
        </div>
      );
    }
  };
  KeybaseUser.initClass();
  return KeybaseUser;
})();
