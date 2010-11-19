/*!
 * makeCache JavaScript Library
 * Version 1.0
 * http://github.com/marcusphillips/make_cache.js
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Dependencies:
 * 
 * MODULE (http://github.com/marcusphillips/module.js)
 * HotDate (http://github.com/marcusphillips/hot_date.js)
 */

MODULE('makeCache', {

  // default configuration

  attachTo: 'jQuery',
  defaultEvictionInterval: 1*60*1000,
  exposeLocals: true

}, function(moduleConfig){


  var undefined;

  var unconstructable = function(maker){
    var me;
    return me = function(){
      if(this instanceof me){
        throw new Error('You tried to call new on a maker function!');
      }
      return maker.apply(this, arguments);
    };
  };


  // library definition

  return unconstructable(function(options) {

    options = options || {};

    var get = function(key) {
      _.checkExpirey(key);
      if(_.items[key]){
        _.removeUse(key);
        _.appendUse(key);
      }
      return (_.items[key] || {}).value;
    };

    var set = function(key, val, options) {
      options = typeof options === 'number' ? {expireIn:options} : options || {};
      if(options.expireIn < 0){
        throw new Error('You cannot specify a negative number for cache item expirey');
      }

      _.items[key] ? _.removeUse(key) : _.size++;

      _.items[key] = {
        key: key,
        value: val
      };
      var expireIn = (options.expireIn || moduleConfig.defaultExpireIn);
      if(expireIn){
        // todo: if we visit the expire at for the exact time, we are uncertain of evicting expired objects
        // we might iterate over the bucket half way through the epoch
        _.items[key].expireAt = new HotDate().add(expireIn);
        _.expireAt(key, _.items[key].expireAt);
      }

      _.appendUse(key);
      _.evictSurplus();
    };

    var remove = function(key) {
      if(_.items[key]){
        _.removeUse(key);
        _.size--;
        delete _.items[key];
      }
    };

    var clear = function() {
      _.size = 0;
      _.items = {};
      _.oldest = undefined;
      _.newest = undefined;
      _.pendingEvictions = {};
      _.evictedEpoch = -1;
    };


    // private variables

    var _ = _VARS({

      evictionInterval: options.evictionInterval || moduleConfig.defaultEvictionInterval,

      limit: options.limit,

      inception: new HotDate(),

      // maximum exact integer is 2^31-1, 10 is headroom
      // this is used as a limit for epoch keys before they cycle through and use new ones
      maxInt: 2147483647 - 10,

      expireAt: function(key, time){
        var epoch = _.getEpoch(time);
        _.pendingEvictions[epoch] = _.pendingEvictions[epoch] || [];
        _.pendingEvictions[epoch].push(key);
      },

      checkExpirey: function(key) {
        if (
          _.items[key] &&
          _.items[key].expireAt &&
          _.items[key].expireAt.hasPassed()
        ) {
          remove(key);
        }
      },

      evictSurplus: function(){
        if(typeof _.limit === 'number'){
          while(_.limit < _.size){
            remove(_.oldest)
          }
        }
      },

      evictExpireds: function(){
        var completedEpoch = _.getEpoch(new HotDate()) - 1;
        if(completedEpoch === -1){ return; }
        // todo: too many possible epochs - iterating over them makes script unresponsive
        for(
          var epoch = (_.evictedEpoch + 1) % _.maxInt;
          epoch !== completedEpoch + 1 % _.maxInt;
          epoch = (epoch+1) % _.maxInt
        ){
          var pendingEvictions = _.pendingEvictions[epoch] || [];
          for(var whichKey = 0; whichKey < pendingEvictions.length; whichKey++){
            _.checkExpirey(pendingEvictions[whichKey]);
          }
          delete _.pendingEvictions[epoch];
          _.evictedEpoch = epoch;
        }
      },

      getEpoch: function(time){
        // todo: time is arbitrarily large - math might be approximate
        var longevity = time - _.inception;
        var partialEpochLongevity = longevity % _.evictionInterval;
        var epoch = ((longevity - partialEpochLongevity) / _.evictionInterval) + 1;
        return epoch % _.maxInt;
      },

      // add a record of key access on the end the use log linked list
      appendUse: function(key){
        var item = _.items[key];
        if(item.newer || item.older){ throw new Error('You tried to append a use without removing it first'); }
        if(_.newest === undefined){
          _.oldest = key;
        }else{
          item.older = _.newest;
          _.items[_.newest].newer = key;
        }
        _.newest = key;
      },

      removeUse: function(key){
        var item = _.items[key];
        item.older ? _.items[item.older].newer = item.newer : _.oldest = item.newer;
        item.newer ? _.items[item.newer].older = item.older : _.newest = item.older;
        delete item.newer;
        delete item.older;
      },

      countSize: function(){
        var size = 0;
        for(var which in _.items){
          size++
        }
        return size;
      }

    });


    clear();

    // todo: allow user to delete the cache and unregister this setinterval
    // todo: autmatically unregister the setInterval on clear()?
    setInterval(function(){ _.evictExpireds(); }, _.evictionInterval);

    var result = {
      clear: clear,
      set: set,
      get: get,
      remove: remove
    };

    if(moduleConfig.exposeLocals){
      _(result);
    }

    return result;

  });

});
