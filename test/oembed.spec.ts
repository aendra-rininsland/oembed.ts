/// <reference path="../typings/tsd.d.ts" />

/**
 * Unit tests for oembed.ts
 */

import OEmbed from '../lib/oembed';
import * as sinon from 'sinon';
import * as chai from 'chai';

let should: Chai.Should = chai.should(); // use Chai's "should" BDD style

describe('oEmbed', () => {
  describe('constructor', () => {
  });

  describe('fetch', () => {
    it('should fetch a resource', (done: MochaDone) => {
      OEmbed.fetch('https://twitter.com/aendrew/status/538358682711752704', {}, (err: any, res: any) => {
        should.not.exist(err);
        done();
      });
    });
  });

  describe('discover', () => {

  });

  describe('fetchXML', () => {

  });

  describe('fetchJSON', () => {

  });
});
