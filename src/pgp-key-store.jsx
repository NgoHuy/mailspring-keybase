/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import MailspringStore from "mailspring-store";
const {
  Actions,
  AttachmentStore,
  DraftStore,
  MessageBodyProcessor,
  RegExpUtils
} = require("mailspring-exports");
const { remote, shell } = require("electron");
const Identity = require("./identity");
const kb = require("./keybase");
const pgp = require("kbpgp");
const _ = require("underscore");
const path = require("path");
const fs = require("fs");
const os = require("os");

class PGPKeyStore extends MailspringStore {
  constructor() {
    super();
    this.validAddress = this.validAddress.bind(this);
    this.watch = this.watch.bind(this);
    this.unwatch = this.unwatch.bind(this);
    this._populate = this._populate.bind(this);
    this.getKeyContents = this.getKeyContents.bind(this);
    this.getKeybaseData = this.getKeybaseData.bind(this);
    this.saveNewKey = this.saveNewKey.bind(this);
    this.exportKey = this.exportKey.bind(this);
    this.deleteKey = this.deleteKey.bind(this);
    this.addAddressToKey = this.addAddressToKey.bind(this);
    this.removeAddressFromKey = this.removeAddressFromKey.bind(this);
    this.pubKeys = this.pubKeys.bind(this);
    this.privKeys = this.privKeys.bind(this);
    this.getDecrypted = this.getDecrypted.bind(this);
    this.decrypt = this.decrypt.bind(this);
    this.decryptAttachments = this.decryptAttachments.bind(this);

    this._identities = {};

    this._msgCache = [];
    this._msgStatus = [];

    // Recursive subdir watching only works on OSX / Windows. annoying
    this._pubWatcher = null;
    this._privWatcher = null;

    this._keyDir = path.join(AppEnv.getConfigDirPath(), "keys");
    this._pubKeyDir = path.join(this._keyDir, "public");
    this._privKeyDir = path.join(this._keyDir, "private");

    // Create the key storage file system if it doesn't already exist
    fs.access(this._keyDir, fs.R_OK | fs.W_OK, err => {
      if (err) {
        return fs.mkdir(this._keyDir, err => {
          if (err) {
            return console.warn(err);
          } else {
            return fs.mkdir(this._pubKeyDir, err => {
              if (err) {
                return console.warn(err);
              } else {
                return fs.mkdir(this._privKeyDir, err => {
                  if (err) {
                    return console.warn(err);
                  } else {
                    return this.watch();
                  }
                });
              }
            });
          }
        });
      } else {
        fs.access(this._pubKeyDir, fs.R_OK | fs.W_OK, err => {
          if (err) {
            return fs.mkdir(this._pubKeyDir, err => {
              if (err) {
                return console.warn(err);
              }
            });
          }
        });
        fs.access(this._privKeyDir, fs.R_OK | fs.W_OK, err => {
          if (err) {
            return fs.mkdir(this._privKeyDir, err => {
              if (err) {
                return console.warn(err);
              }
            });
          }
        });
        this._populate();
        return this.watch();
      }
    });
  }

  validAddress(address, isPub) {
    if (!address || address.length === 0) {
      this._displayError("You must provide an email address.");
      return false;
    }
    if (!RegExpUtils.emailRegex().test(address)) {
      this._displayError("Invalid email address.");
      return false;
    }
    const keys = isPub
      ? this.pubKeys(address)
      : this.privKeys({ address, timed: false });
    const keystate = isPub ? "public" : "private";
    if (keys.length > 0) {
      this._displayError(
        `A PGP ${keystate} key for that email address already exists.`
      );
      return false;
    }
    return true;
  }

  /* I/O and File Tracking */

  watch() {
    if (!this._pubWatcher) {
      this._pubWatcher = fs.watch(this._pubKeyDir, this._populate);
    }
    if (!this._privWatcher) {
      return (this._privWatcher = fs.watch(this._privKeyDir, this._populate));
    }
  }

  unwatch() {
    if (this._pubWatcher) {
      this._pubWatcher.close();
    }
    this._pubWatcher = null;
    if (this._privWatcher) {
      this._privWatcher.close();
    }
    return (this._privWatcher = null);
  }

  _populate() {
    // add identity elements to later be populated with keys from disk
    // TODO if this function is called multiple times in quick succession it
    // will duplicate keys - need to do deduplication on add
    return fs.readdir(this._pubKeyDir, (err, pubFilenames) => {
      return fs.readdir(this._privKeyDir, (err, privFilenames) => {
        this._identities = {};
        return _.each(
          [[pubFilenames, false], [privFilenames, true]],
          readresults => {
            const filenames = readresults[0];
            let i = 0;
            if (filenames.length === 0) {
              this.trigger(this);
            }
            return (() => {
              const result = [];
              while (i < filenames.length) {
                const filename = filenames[i];
                if (filename[0] === ".") {
                  continue;
                }
                const ident = new Identity({
                  addresses: filename.split(" "),
                  isPriv: readresults[1]
                });
                this._identities[ident.clientId] = ident;
                this.trigger(this);
                result.push(i++);
              }
              return result;
            })();
          }
        );
      });
    });
  }

  getKeyContents({ key, passphrase, callback }) {
    // Reads an actual PGP key from disk and adds it to the preexisting metadata
    if (key.keyPath == null) {
      console.error("Identity has no path for key!", key);
      return;
    }
    return fs.readFile(key.keyPath, (err, data) => {
      return pgp.KeyManager.import_from_armored_pgp(
        {
          armored: data
        },
        (err, km) => {
          if (err) {
            console.warn(err);
          } else {
            if (km.is_pgp_locked()) {
              // private key - check passphrase
              if (passphrase == null) {
                passphrase = "";
              }
              km.unlock_pgp({ passphrase }, err => {
                if (err) {
                  // decrypt checks all keys, so DON'T open an error dialog
                  console.warn(err);
                  return;
                } else {
                  key.key = km;
                  key.setTimeout();
                  if (callback != null) {
                    return callback(key);
                  }
                }
              });
            } else {
              // public key - get keybase data
              key.key = km;
              key.setTimeout();
              this.getKeybaseData(key);
              if (callback != null) {
                callback(key);
              }
            }
          }
          return this.trigger(this);
        }
      );
    });
  }

  getKeybaseData(identity) {
    // Given a key, fetches metadata from keybase about that key
    // TODO currently only works for public keys
    if (identity.key == null && !identity.isPriv && !identity.keybase_profile) {
      return this.getKeyContents({ key: identity });
    } else {
      const fingerprint = identity.fingerprint();
      if (fingerprint != null) {
        return kb.getUser(fingerprint, "key_fingerprint", (err, user) => {
          if (err) {
            console.error(err);
          }
          if ((user != null ? user.length : undefined) === 1) {
            identity.keybase_profile = user[0];
          }
          return this.trigger(this);
        });
      }
    }
  }

  saveNewKey(identity, contents) {
    // Validate the email address(es), then write to file.
    if (!identity instanceof Identity) {
      console.error("saveNewKey requires an identity object");
      return;
    }
    const { addresses } = identity;
    if (addresses.length < 1) {
      console.error(
        "Identity must have at least one email address to save key"
      );
      return;
    }
    if (
      _.every(addresses, address =>
        this.validAddress(address, !identity.isPriv)
      )
    ) {
      // Just say no to trailing whitespace.
      if (contents.charAt(contents.length - 1) !== "-") {
        contents = contents.slice(0, -1);
      }
      return fs.writeFile(identity.keyPath, contents, err => {
        if (err) {
          return this._displayError(err);
        }
      });
    }
  }

  exportKey({ identity, passphrase }) {
    const atIndex = identity.addresses[0].indexOf("@");
    const suffix = identity.isPriv ? "-private.asc" : ".asc";
    const shortName = identity.addresses[0].slice(0, atIndex).concat(suffix);
    if (AppEnv.savedState.lastKeybaseDownloadDirectory == null) {
      AppEnv.savedState.lastKeybaseDownloadDirectory = os.homedir();
    }
    const savePath = path.join(
      AppEnv.savedState.lastKeybaseDownloadDirectory,
      shortName
    );
    return this.getKeyContents({
      key: identity,
      passphrase,
      callback: identity => {
        return AppEnv.showSaveDialog(
          {
            title: "Export PGP Key",
            defaultPath: savePath
          },
          keyPath => {
            if (!keyPath) {
              return;
            }
            AppEnv.savedState.lastKeybaseDownloadDirectory = keyPath.slice(
              0,
              keyPath.length - shortName.length
            );
            if (passphrase != null) {
              return identity.key.export_pgp_private(
                { passphrase },
                (err, pgp_private) => {
                  if (err) {
                    this._displayError(err);
                  }
                  return fs.writeFile(keyPath, pgp_private, err => {
                    if (err) {
                      this._displayError(err);
                    }
                    return shell.showItemInFolder(keyPath);
                  });
                }
              );
            } else {
              return identity.key.export_pgp_public({}, (err, pgp_public) => {
                return fs.writeFile(keyPath, pgp_public, err => {
                  if (err) {
                    this._displayError(err);
                  }
                  return shell.showItemInFolder(keyPath);
                });
              });
            }
          }
        );
      }
    });
  }

  deleteKey(key) {
    if (
      this._displayDialog(
        "Delete this key?",
        "The key will be permanently deleted.",
        ["Delete", "Cancel"]
      )
    ) {
      return fs.unlink(key.keyPath, err => {
        if (err) {
          this._displayError(err);
        }
        return this._populate();
      });
    }
  }

  addAddressToKey(profile, address) {
    if (this.validAddress(address, !profile.isPriv)) {
      const oldPath = profile.keyPath;
      profile.addresses.push(address);
      return fs.rename(oldPath, profile.keyPath, err => {
        if (err) {
          return this._displayError(err);
        }
      });
    }
  }

  removeAddressFromKey(profile, address) {
    if (profile.addresses.length > 1) {
      const oldPath = profile.keyPath;
      profile.addresses = _.without(profile.addresses, address);
      return fs.rename(oldPath, profile.keyPath, err => {
        if (err) {
          return this._displayError(err);
        }
      });
    } else {
      return this.deleteKey(profile);
    }
  }

  /* Internal Key Management */

  pubKeys(addresses) {
    // fetch public identity/ies for an address (synchronous)
    // if no address, return them all
    let identities = _.where(_.values(this._identities), { isPriv: false });

    if (addresses == null) {
      return identities;
    }

    if (typeof addresses === "string") {
      addresses = [addresses];
    }

    identities = _.filter(
      identities,
      identity => _.intersection(addresses, identity.addresses).length > 0
    );
    return identities;
  }

  privKeys(param) {
    // fetch private identity/ies for an address (synchronous).
    // by default, only return non-timed-out keys
    // if no address, return them all
    if (param == null) {
      param = { timed: true };
    }
    const { address, timed } = param;
    let identities = _.where(_.values(this._identities), { isPriv: true });

    if (address != null) {
      identities = _.filter(identities, identity =>
        Array.from(identity.addresses).includes(address)
      );
    }

    if (timed) {
      identities = _.reject(identities, identity => identity.isTimedOut());
    }

    return identities;
  }

  _displayError(err) {
    const { dialog } = remote;
    return dialog.showErrorBox("Key Management Error", err.toString());
  }

  _displayDialog(title, message, buttons) {
    const { dialog } = remote;
    return (
      dialog.showMessageBox({
        title,
        message: title,
        detail: message,
        buttons,
        type: "info"
      }) === 0
    );
  }

  msgStatus(msg) {
    // fetch the latest status of a message
    let status;
    if (msg == null) {
      return null;
    } else {
      const { clientId } = msg;
      const statuses = _.filter(
        this._msgStatus,
        status => status.clientId === clientId
      );
      status = _.max(statuses, stat => stat.time);
    }
    return status.message;
  }

  isDecrypted(message) {
    // if the message is already decrypted, return true
    // if the message has no encrypted component, return true
    // if the message has an encrypted component that is not yet decrypted, return false
    if (!this.hasEncryptedComponent(message)) {
      return true;
    } else if (this.getDecrypted(message) != null) {
      return true;
    } else {
      return false;
    }
  }

  getDecrypted(message) {
    // Fetch a cached decrypted message
    // (synchronous)

    let needle;
    if (
      ((needle = message.clientId),
      Array.from(_.pluck(this._msgCache, "clientId")).includes(needle))
    ) {
      const msg = _.findWhere(this._msgCache, { clientId: message.clientId });
      if (msg.timeout > Date.now()) {
        return msg.body;
      }
    }

    // otherwise
    return null;
  }

  hasEncryptedComponent(message) {
    if (message.body == null) {
      return false;
    }

    // find a PGP block
    const pgpStart = "-----BEGIN PGP MESSAGE-----";
    const pgpEnd = "-----END PGP MESSAGE-----";

    const blockStart = message.body.indexOf(pgpStart);
    const blockEnd = message.body.indexOf(pgpEnd);
    // if they're both present, assume an encrypted block
    return blockStart >= 0 && blockEnd >= 0;
  }

  fetchEncryptedAttachments(message) {
    const encrypted = _.map(message.files, file => {
      // calendars don't have filenames
      if (file.filename != null) {
        const tokenized = file.filename.split(".");
        const extension = tokenized[tokenized.length - 1];
        if (extension === "asc" || extension === "pgp") {
          // something.asc or something.pgp -> assume encrypted attachment
          return file;
        } else {
          return null;
        }
      } else {
        return null;
      }
    });
    // NOTE for now we don't verify that the .asc/.pgp files actually have a PGP
    // block inside

    return _.compact(encrypted);
  }

  decrypt(message) {
    // decrypt a message, cache the result
    // (asynchronous)

    // check to make sure we haven't already decrypted and cached the message
    // note: could be a race condition here causing us to decrypt multiple times
    // (not that that's a big deal other than minor resource wastage)
    if (this.getDecrypted(message) != null) {
      return;
    }

    if (!this.hasEncryptedComponent(message)) {
      return;
    }

    // fill our keyring with all possible private keys
    const ring = new pgp.keyring.KeyRing();
    // (the unbox function will use the right one)

    for (let key of Array.from(this.privKeys({ timed: true }))) {
      if (key.key != null) {
        ring.add_key_manager(key.key);
      }
    }

    // find a PGP block
    const pgpStart = "-----BEGIN PGP MESSAGE-----";
    const blockStart = message.body.indexOf(pgpStart);

    const pgpEnd = "-----END PGP MESSAGE-----";
    const blockEnd = message.body.indexOf(pgpEnd) + pgpEnd.length;

    // if we don't find those, it isn't encrypted
    if (!(blockStart >= 0) || !(blockEnd >= 0)) {
      return;
    }

    let pgpMsg = message.body.slice(blockStart, blockEnd);

    // Some users may send messages from sources that pollute the encrypted block.
    pgpMsg = pgpMsg.replace(/&#43;/gm, "+");
    pgpMsg = pgpMsg.replace(/(<br>)/g, "\n");
    pgpMsg = pgpMsg.replace(
      /<\/(blockquote|div|dl|dt|dd|form|h1|h2|h3|h4|h5|h6|hr|ol|p|pre|table|tr|td|ul|li|section|header|footer)>/g,
      "\n"
    );
    pgpMsg = pgpMsg.replace(/<(.+?)>/g, "");
    pgpMsg = pgpMsg.replace(/&nbsp;/g, " ");

    return pgp.unbox(
      { keyfetch: ring, armored: pgpMsg },
      (err, literals, warnings, subkey) => {
        if (err) {
          console.warn(err);
          let errMsg = "Unable to decrypt message.";
          if (
            err.toString().indexOf("tailer found") >= 0 ||
            err.toString().indexOf("checksum mismatch") >= 0
          ) {
            errMsg = "Unable to decrypt message. Encrypted block is malformed.";
          } else if (err.toString().indexOf("key not found:") >= 0) {
            errMsg =
              "Unable to decrypt message. Private key does not match encrypted block.";
            if (this.msgStatus(message) == null) {
              errMsg = "Decryption preprocessing failed.";
            }
          }
          //Actions.recordUserEvent("Email Decryption Errored", {
          error: errMsg;

          return this._msgStatus.push({
            clientId: message.clientId,
            time: Date.now(),
            message: errMsg
          });
        } else {
          if (warnings._w.length > 0) {
            console.warn(warnings._w);
          }

          if (literals.length > 0) {
            let plaintext = literals[0].toString("utf8");

            // <pre> tag for consistent styling
            if (plaintext.indexOf("<pre>") === -1) {
              plaintext = `<pre>\n${plaintext}\n</pre>`;
            }

            // can't use _.template :(
            const body =
              message.body.slice(0, blockStart) +
              plaintext +
              message.body.slice(blockEnd);

            // TODO if message is already in the cache, consider updating its TTL
            const timeout = 1000 * 60 * 30; // 30 minutes in ms
            this._msgCache.push({
              clientId: message.clientId,
              body,
              timeout: Date.now() + timeout
            });
            const keyprint = subkey.get_fingerprint().toString("hex");
            this._msgStatus.push({
              clientId: message.clientId,
              time: Date.now(),
              message: `Message decrypted with key ${keyprint}`
            });
            // re-render messages
            //Actions.recordUserEvent("Email Decrypted");
            MessageBodyProcessor.resetCache();
            return this.trigger(this);
          } else {
            console.warn("Unable to decrypt message.");
            return this._msgStatus.push({
              clientId: message.clientId,
              time: Date.now(),
              message: "Unable to decrypt message."
            });
          }
        }
      }
    );
  }

  decryptAttachments(identity, files) {
    // fill our keyring with all possible private keys
    const keyring = new pgp.keyring.KeyRing();
    // (the unbox function will use the right one)

    if (identity.key != null) {
      keyring.add_key_manager(identity.key);
    }

    return AttachmentStore._fetchAndSaveAll(files).then(filepaths =>
      // open, decrypt, and resave each of the newly-downloaded files in place
      _.each(filepaths, filepath => {
        return fs.readFile(filepath, (err, data) => {
          // find a PGP block
          const pgpStart = "-----BEGIN PGP MESSAGE-----";
          const blockStart = data.indexOf(pgpStart);

          const pgpEnd = "-----END PGP MESSAGE-----";
          const blockEnd = data.indexOf(pgpEnd) + pgpEnd.length;

          // if we don't find those, it isn't encrypted
          if (!(blockStart >= 0) || !(blockEnd >= 0)) {
            return;
          }

          const pgpMsg = data.slice(blockStart, blockEnd);

          // decrypt the file
          return pgp.unbox(
            { keyfetch: keyring, armored: pgpMsg },
            (err, literals, warnings, subkey) => {
              if (err) {
                console.warn(err);
              } else {
                if (warnings._w.length > 0) {
                  console.warn(warnings._w);
                }
              }

              const literalLen = literals != null ? literals.length : undefined;
              // if we have no literals, failed to decrypt and should abort
              if (literalLen == null) {
                return;
              }

              if (literalLen === 1) {
                // success! replace old encrypted file with awesome decrypted file
                filepath = filepath.slice(0, filepath.length - 3).concat("txt");
                return fs.writeFile(filepath, literals[0].toBuffer(), err => {
                  if (err) {
                    return console.warn(err);
                  }
                });
              } else {
                return console.warn(
                  `Attempt to decrypt attachment failed: ${
                    literalLen
                  } literals found, expected 1.`
                );
              }
            }
          );
        });
      })
    );
  }
}

module.exports = new PGPKeyStore();
