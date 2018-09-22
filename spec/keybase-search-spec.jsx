/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {React, ReactTestUtils, Message} = require('mailspring-exports');

const KeybaseSearch = require('../lib/keybase-search');

describe("KeybaseSearch", function() {
  it("should have a displayName", () => expect(KeybaseSearch.displayName).toBe('KeybaseSearch'));

  return it("should have no results when rendered", function() {
    this.component = ReactTestUtils.renderIntoDocument(
      React.createElement(KeybaseSearch, null)
    );

    return expect(this.component.state.results).toEqual([]);
  });
});

// behold, the most comprehensive test suite of all time
