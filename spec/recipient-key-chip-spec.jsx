/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {React, ReactTestUtils, DraftStore, Contact} = require('mailspring-exports');
const pgp = require('kbpgp');

const RecipientKeyChip = require('../lib/recipient-key-chip');
const PGPKeyStore = require('../lib/pgp-key-store');

describe("DecryptMessageButton", function() {
  beforeEach(function() {
    this.contact = new Contact({email: "test@example.com"});
    return this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(RecipientKeyChip, {"contact": this.contact})
    );
  });

  it("should render into the page", function() {
    return expect(this.component).toBeDefined();
  });

  it("should have a displayName", () => expect(RecipientKeyChip.displayName).toBe('RecipientKeyChip'));

  xit("should indicate when a recipient has a PGP key available", function() {
    spyOn(PGPKeyStore, "pubKeys").andCallFake(address => {
      return [{'key':0}];
  });
    const key = PGPKeyStore.pubKeys(this.contact.email);
    expect(key).toBeDefined();

    // TODO these calls crash the tester because they require a call to getKeyContents
    expect(this.component.refs.keyIcon).toBeDefined();
    return expect(this.component.refs.noKeyIcon).not.toBeDefined();
  });

  return xit("should indicate when a recipient does not have a PGP key available", function() {
    const component = ReactTestUtils.renderIntoDocument(
      React.createElement(RecipientKeyChip, {"contact": this.contact})
    );

    const key = PGPKeyStore.pubKeys(this.contact.email);
    expect(key).toEqual([]);

    // TODO these calls crash the tester because they require a call to getKeyContents
    expect(component.refs.keyIcon).not.toBeDefined();
    return expect(component.refs.noKeyIcon).toBeDefined();
  });
});
