/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {React, ReactTestUtils, DraftStore, Message} = require('mailspring-exports');
const pgp = require('kbpgp');

const DecryptMessageButton = require('../lib/decrypt-button');
const PGPKeyStore = require('../lib/pgp-key-store');

describe("DecryptMessageButton", function() {
  beforeEach(function() {
    this.unencryptedMsg = new Message({clientId: 'test', subject: 'Subject', body: '<p>Body</p>'});
    const body = `-----BEGIN PGP MESSAGE-----
Version: Keybase OpenPGP v2.0.52 Comment: keybase.io/crypto

wcBMA5nwa6GWVDOUAQf+MjiVRIBWJyM6The6/h2MgSJTDyrN9teFFJTizOvgHNnD W4EpEmmhShNyERI67qXhC03lFczu2Zp2Qofgs8YePIEv7wwb27/cviODsE42YJvX 1zGir+jBp81s9ZiF4dex6Ir9XfiZJlypI2QV2dHjO+5pstW+XhKIc1R5vKvoFTGI 1XmZtL3EgtKfj/HkPUkq2N0G5kAoB2MTTQuurfXm+3TRkftqesyTKlek652sFjCv nSF+LQ1GYq5hI4YaUBiHnZd7wKUgDrIh2rzbuGq+AHjrHdVLMfRTbN0Xsy3OWRcC 9uWU8Nln00Ly6KbTqPXKcBDcMrOJuoxYcpmLlhRds9JoAY7MyIsj87M2mkTtAtMK hqK0PPvJKfepV+eljDhQ7y0TQ0IvNtO5/pcY2CozbFJncm/ToxxZPNJueKRcz+EH M9uBvrWNTwfHj26g405gpRDN1T8CsY5ZeiaDHduIKnBWd4za0ak0Xfw=
=1aPN
-----END PGP MESSAGE-----`;
    this.encryptedMsg = new Message({clientId: 'test2', subject: 'Subject', body});

    this.msg = new Message({subject: 'Subject', body: '<p>Body</p>'});
    return this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(DecryptMessageButton, {"message": (this.msg)})
    );
  });

  xit("should try to decrypt the message whenever a new key is unlocked", function() {
    spyOn(PGPKeyStore, "decrypt");
    spyOn(PGPKeyStore, "isDecrypted").andCallFake(message => {
      return false;
    });
    spyOn(PGPKeyStore, "hasEncryptedComponent").andCallFake(message => {
      return true;
    });

    PGPKeyStore.trigger(PGPKeyStore);
    return expect(PGPKeyStore.decrypt).toHaveBeenCalled();
  });

  xit(`should not try to decrypt the message whenever a new key is unlocked \
if the message is already decrypted`, function() {
    spyOn(PGPKeyStore, "decrypt");
    spyOn(PGPKeyStore, "isDecrypted").andCallFake(message => {
      return true;
  });
    spyOn(PGPKeyStore, "hasEncryptedComponent").andCallFake(message => {
      return true;
  });

    // TODO for some reason the above spyOn calls aren't working and false is
    // being returned from isDecrypted, causing this test to fail
    PGPKeyStore.trigger(PGPKeyStore);

    return expect(PGPKeyStore.decrypt).not.toHaveBeenCalled();
  });

  it("should have a button to decrypt a message", function() {
    this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(DecryptMessageButton, {"message": this.encryptedMsg})
    );

    return expect(this.component.refs.button).toBeDefined();
  });

  it("should not allow for the unlocking of a message with no encrypted component", function() {
    this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(DecryptMessageButton, {"message": this.unencryptedMsg})
    );

    return expect(this.component.refs.button).not.toBeDefined();
  });

  it("should indicate when a message has been decrypted", function() {
    spyOn(PGPKeyStore, "isDecrypted").andCallFake(message => {
      return true;
  });

    this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(DecryptMessageButton, {"message": this.encryptedMsg})
    );

    return expect(this.component.refs.button).not.toBeDefined();
  });

  return it("should open a popover when clicked", function() {
    spyOn(DecryptMessageButton.prototype, "_onClickDecrypt");

    const msg = this.encryptedMsg;
    msg.to = [{email: "test@example.com"}];
    this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(DecryptMessageButton, {"message": msg})
    );
    expect(this.component.refs.button).toBeDefined();
    ReactTestUtils.Simulate.click(this.component.refs.button);
    return expect(DecryptMessageButton.prototype._onClickDecrypt).toHaveBeenCalled();
  });
});
