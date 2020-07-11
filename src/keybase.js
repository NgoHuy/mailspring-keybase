/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require("underscore");
const request = require("request");

class KeybaseAPI {
  constructor() {
    this.getUser = this.getUser.bind(this);
    this.getKey = this.getKey.bind(this);
    this.autocomplete = this.autocomplete.bind(this);
    this._keybaseRequest = this._keybaseRequest.bind(this);
    this.baseUrl = "https://keybase.io";
  }

  getUser(key, keyType, callback) {
    if (
      [
        "usernames",
        "domain",
        "twitter",
        "github",
        "reddit",
        "hackernews",
        "coinbase",
        "key_fingerprint"
      ].includes(!keyType)
    ) {
      console.error("keyType must be a supported Keybase query type.");
    }

    return this._keybaseRequest(
      `/_/api/1.0/user/lookup.json?${keyType}=${key}`,
      (err, resp, obj) => {
        if (err) {
          return callback(err, null);
        }
        if (obj == null || obj.them == null) {
          return callback(new Error("Empty response!"), null);
        }
        if (obj.status != null) {
          if (obj.status.name !== "OK") {
            return callback(new Error(obj.status.desc), null);
          }
        }

        return callback(null, _.map(obj.them, this._regularToAutocomplete));
      }
    );
  }

  getKey(username, callback) {
    return request(
      {
        url: this.baseUrl + `/${username}/key.asc`,
        headers: { "User-Agent": "request" }
      },
      (err, resp, obj) => {
        if (err) {
          return callback(err, null);
        }
        if (obj == null) {
          return callback(new Error(`No key found for ${username}`), null);
        }
        if (!obj.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
          return callback(
            new Error(`No key returned from keybase for ${username}`),
            null
          );
        }
        return callback(null, obj);
      }
    );
  }

  autocomplete(query, callback) {
    const url = "/_/api/1.0/user/autocomplete.json";
    return request(
      {
        url: this.baseUrl + url,
        form: { q: query },
        headers: { "User-Agent": "request" },
        json: true
      },
      (err, resp, obj) => {
        if (err) {
          return callback(err, null);
        }
        if (obj.status != null) {
          if (obj.status.name !== "OK") {
            return callback(new Error(obj.status.desc), null);
          }
        }

        return callback(null, obj.completions);
      }
    );
  }

  _keybaseRequest(url, callback) {
    return request(
      {
        url: this.baseUrl + url,
        headers: { "User-Agent": "request" },
        json: true
      },
      callback
    );
  }

  _regularToAutocomplete(profile) {
    // converts a keybase profile to the weird format used in the autocomplete
    // endpoint for backward compatability
    // (does NOT translate accounts - e.g. twitter, github - yet)
    // TODO this should be the other way around
    const cleanedProfile = { components: {} };
    cleanedProfile.thumbnail = null;
    if (
      (profile.pictures != null ? profile.pictures.primary : undefined) != null
    ) {
      cleanedProfile.thumbnail = profile.pictures.primary.url;
    }
    const safe_name = profile.profile != null ? profile.profile.full_name : "";
    cleanedProfile.components = {
      full_name: { val: safe_name },
      username: { val: profile.basics.username }
    };
    _.each(profile.proofs_summary.all, connectedAccount => {
      const component = {};
      component[connectedAccount.proof_type] = {
        val: connectedAccount.nametag
      };
      return (cleanedProfile.components = _.extend(
        cleanedProfile.components,
        component
      ));
    });
    return cleanedProfile;
  }
}

module.exports = new KeybaseAPI();
