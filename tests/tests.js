module("makeCache");

if(typeof MODULE === 'undefined'){
  alert('MODULE is not defined - did you run "git submodule init" and "git submodule update"?');
}

test("cache", function(){
  // todo: test cache.fallback
  var cache = makeCache({limit:3});

  equal(cache._('countSize')(), 0, 'initial size is 0');

  equal(cache.get('a'), undefined, 'undefined cache keys are undefined');
  cache.set('a', '1');
  equal(cache._('countSize')(), 1, 'cache with one key reports size of 1');
  equal(cache.get('a'), '1', 'first cache key returns expected value');

  cache.set('b', '2');
  cache.set('c', '3');
  equal(cache._('countSize')(), 3, 'after inserting two more keys, cache size is 3');

  cache.set('d', '4');
  equal(cache._('countSize')(), 3, 'cache size does not exceed supplied limit of 3');

  equal(cache.get('a'), undefined, 'earliest defined item is not in cache after size limit was exceeded');
  equal(cache.get('b'), '2', '3 most recently used values are still in cache');
  equal(cache.get('c'), '3', '3 most recently used values are still in cache');
  equal(cache.get('d'), '4', '3 most recently used values are still in cache');

  cache.remove('b');
  equal(cache.get('b'), undefined, 'a removed key returns undefined');
  equal(cache.get('c'), '3', 'unremoved key remains in the cache');
  equal(cache._('countSize')(), 2, 'having removed a key, size is one less');

  cache.clear();
  equal(cache.get('c'), undefined, 'remaining keys are removed by clear operation');
  equal(cache.get('d'), undefined, 'remaining keys are removed by clear operation');
  equal(cache._('countSize')(), 0, 'size after clear is 0');

});

test("cache expiration", function(){
  var cache = makeCache();

  cache.set('expires', 'expires', {expireIn: 100});
  equal(cache._('countSize')(), 1, 'after adding first value, cache size is 1');
  equal(cache.get('expires'), 'expires', 'expiring value persists immediately after');

  stop();
  setTimeout(function() {
    equal(cache.get('expires'), undefined, 'expiring value expires shortly after');
    equal(cache._('countSize')(), 0, 'after expirey, cache size is 0');
    start();
  }, 200);

});

test("many cache expirations", function(){
  var sinceStart, timeToNextPeriod;
  var periodLength = 100;
  var itemCount = 10;
  var evictionInterval = ~~(periodLength/10) || 1;
  var cache = makeCache({evictionInterval:evictionInterval});
  var startedAt = new Date().getTime();
  for(var i=0; i<itemCount; i++){
    sinceStart = new Date().getTime() - startedAt;
    timeToNextPeriod = (i+1)*periodLength - sinceStart;
    cache.set(i, i, {expireIn: timeToNextPeriod});
  }

  stop();
  (function checkCache(){
    sinceStart = new Date().getTime() - startedAt;
    if(sinceStart < (itemCount+1)*periodLength){
      var periodsSinceStart = ~~(sinceStart/periodLength);
      var expectedCacheSize = itemCount - periodsSinceStart;
      equal(cache._('countSize')(), expectedCacheSize, 'at '+sinceStart+'ms, cache size is '+cache._('countSize')()+' and should be '+expectedCacheSize);
      sinceStart = (new Date().getTime() - startedAt);
      var timeSinceLastHalfPeriod = sinceStart % periodLength - periodLength/2;
      setTimeout(function(){ checkCache(); }, periodLength - timeSinceLastHalfPeriod);
    }else{
      start();
    }
  }());

});
