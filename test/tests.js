var context = {
  setup: function () {
    $.db('test').insert([
      { name: 'User01', age: 20 },
      { name: 'User02', age: 12, isChild: true },
      { name: 'User03', age: 65 },
      { name: 'User04', age: 0, isBaby: true },
      { name: 'User05' }
    ]);

  },
  teardown: function () {
    $.db('test').drop();
  }
}

module('localStorage find', context);

test('all read', function () {
  var test = $.db('test').find();
  
  strictEqual(test.length, 5, 'data count');
  strictEqual(test[0].age, 20, 'get number value');
  strictEqual(test[3].isBaby, true, 'get boolean value');
});

test('$eq, $ne condition', function () {
  var user01 = $.db('test').find({name: 'User01'});
  strictEqual(user01.length, 1, '$eq');
  
  var baby = $.db('test').find({ isBaby: true });
  strictEqual(baby.length, 1, '$eq');
  strictEqual(baby[0].name, 'User04', '$eq get string value');
  
  var ne = $.db('test').find({age: { $ne: 20 }});
  strictEqual(ne.length, 4, '$ne');
});

test('$gt, $lt, $gte, $lte condition', function () {
  var gt = $.db('test').find({ age: { $gt: 20 } });
  strictEqual(gt.length, 1, '$gt');
  
  var lt = $.db('test').find({ age: { $lt: 20 } });
  strictEqual(lt.length, 2, '$lt');

  var gte = $.db('test').find({ age: { $gte: 20 } });
  strictEqual(gte.length, 2, '$gte')
  
  var lte = $.db('test').find({ age: { $lte: 20 } });
  strictEqual(lte.length, 3, '$lte');
  
  var gtelt = $.db('test').find({ age: { $gte: 10, $lt: 20 } });
  strictEqual(gtelt.length, 1, '$gte and $lt');
  
  var gtlte = $.db('test').find({ age: { $gt: 10, $lte: 20 } });
  strictEqual(gtlte.length, 2, '$gt and $lte');
});

test('$in, $nin condition', function () {
  var $in = $.db('test').find({ age: { $in: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] } });
  strictEqual($in.length, 2, '$in');
  
  var $nin = $.db('test').find({ age: { $nin: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] } });
  strictEqual($nin.length, 3, '$nin');
});

test('$or condition', function () {
  var $or = $.db('test').find({ $or: [{age: {$lt: 10}}, {age: {$gt: 20}}] });
  strictEqual($or.length, 2, '$or');
});

test('some condition', function () {
  var oreqlt = $.db('test').find({ $or: [ { isChild: true }, { age: { $lt: 20 } } ] });
  strictEqual(oreqlt.length, 2, '$or and $eq and $lt');

});