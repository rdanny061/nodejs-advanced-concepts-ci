const mongoose = require("mongoose");

const redis = require("redis");
const util = require("util");

const redisURL = "redis://127.0.0.1:6379";
const client = redis.createClient(redisURL);

client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = async function (options = {}) {
  this._useCache = true;
  this._hashKey = JSON.stringify(options.key || "");
  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this._useCache) {
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  // See if we have a value for 'key' in reids
  const cacheValue = await client.hget(this._hashKey, key);

  // if we do, return that

  if (cacheValue) {
    // const doc = new this.model(JSON.parse(cacheValue));

    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map((x) => new this.model(x))
      : new this.model(doc);
  }

  // Otherwise, issue the query and store the result in redis
  const result = await exec.apply(this, arguments);
  client.hset(this._hashKey, key, JSON.stringify(result));
  client.expire(this._hashKey, 10);
  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
