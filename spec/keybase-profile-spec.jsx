/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {React, ReactTestUtils, Message} = require('mailspring-exports');

const KeybaseUser = require('../lib/keybase-user');

describe("KeybaseUserProfile", () =>
  it("should have a displayName", () => expect(KeybaseUser.displayName).toBe('KeybaseUserProfile'))
);

// behold, the most comprehensive test suite of all time
