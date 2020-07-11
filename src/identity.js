/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// A single user identity: a key, a way to find that key, one or more email
// addresses, and a keybase profile

let Identity;
const { Utils } = require("mailspring-exports");
const path = require("path");

module.exports = Identity = class Identity {
  constructor({ key, addresses, isPriv, keybase_profile }) {
    this.clientId = Utils.generateTempId();
    this.key = key != null ? key : null; // keybase keymanager object
    this.isPriv = isPriv != null ? isPriv : false; // is this a private key?
    this.timeout = null; // the time after which this key (if private) needs to be unlocked again
    this.addresses = addresses != null ? addresses : []; // email addresses associated with this identity
    this.keybase_profile = keybase_profile != null ? keybase_profile : null; // a kb profile object associated with this identity

    Object.defineProperty(this, "keyPath", {
      get() {
        let keyPath;
        if (this.addresses.length > 0) {
          const keyDir = path.join(AppEnv.getConfigDirPath(), "keys");
          const thisDir = this.isPriv
            ? path.join(keyDir, "private")
            : path.join(keyDir, "public");
          keyPath = path.join(thisDir, this.addresses.join(" "));
        } else {
          keyPath = null;
        }
        return keyPath;
      }
    });

    if (this.isPriv) {
      this.setTimeout();
    }
  }

  fingerprint() {
    if (this.key != null) {
      return this.key.get_pgp_fingerprint().toString("hex");
    }
    return null;
  }

  setTimeout() {
    const delay = 1000 * 60 * 30; // 30 minutes in ms
    return (this.timeout = Date.now() + delay);
  }

  isTimedOut() {
    return this.timeout < Date.now();
  }

  uid() {
    let uid;
    if (this.key != null) {
      uid = this.key.get_pgp_fingerprint().toString("hex");
    } else if (this.keybase_profile != null) {
      uid = this.keybase_profile.components.username.val;
    } else if (this.addresses.length > 0) {
      uid = this.addresses.join("");
    } else {
      uid = this.clientId;
    }

    return uid;
  }
};
