/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const kb = require("../lib/keybase");

xdescribe("keybase lib", function() {
  // TODO stub keybase calls?
  it("should be able to fetch an account by username", function() {
    this.them = null;
    runs(() => {
      return kb.getUser("dakota", "usernames", (err, them) => {
        return (this.them = them);
      });
    });
    waitsFor(() => this.them !== null, 2000);
    return runs(() => {
      return expect(
        this.them != null ? this.them[0].components.username.val : undefined
      ).toEqual("dakota");
    });
  });

  it("should be able to fetch an account by key fingerprint", function() {
    this.them = null;
    runs(() => {
      return kb.getUser(
        "7FA5A43BBF2BAD1845C8D0E8145FCCD989968E3B",
        "key_fingerprint",
        (err, them) => {
          return (this.them = them);
        }
      );
    });
    waitsFor(() => this.them !== null, 2000);
    return runs(() => {
      return expect(
        this.them != null ? this.them[0].components.username.val : undefined
      ).toEqual("dakota");
    });
  });

  it("should be able to fetch a user's key", function() {
    this.key = null;
    runs(() => {
      return kb.getKey("dakota", (error, key) => {
        return (this.key = key);
      });
    });
    waitsFor(() => this.key !== null, 2000);
    return runs(() => {
      return expect(
        this.key != null
          ? this.key.startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")
          : undefined
      );
    });
  });

  return it("should be able to return an autocomplete query", function() {
    this.completions = null;
    runs(() => {
      return kb.autocomplete("dakota", (error, completions) => {
        return (this.completions = completions);
      });
    });
    waitsFor(() => this.completions !== null, 2000);
    return runs(() => {
      return expect(this.completions[0].components.username.val).toEqual(
        "dakota"
      );
    });
  });
});
