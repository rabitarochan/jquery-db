/**
 * jQuery Db Plugin v0.1
 * https://github.com/rabitarochan/jquery-db
 *
 * Copyright 2013 Kengo Asamizu (rabitarochan)
 * Released under the MIT license.
 */
(function($){

  // string format like .NET Framework
  var $format = function (format, arg) {
    var f;
    if (typeof(arg) == 'object') {
      f = function (match, key) { return arg[key]; }
    } else {
      var args = arguments;
      f = function (match, key) { return args[parseInt(key) + 1]; }
    }
    return format.replace(/\{(\w+)\}/g, f);
  }

  var PREFIX = "db.";

  var Types = {
    isNumber: function (x) { return (typeof(x) == 'number'); },
    isString: function (x) { return (typeof(x) == 'string'); },
    isBoolean: function (x) { return (typeof(x) == 'boolean'); },
    isUndefined: function (x) { return (x == undefined); },
    isArray: function (x) { return (x instanceof Array); },
    isObject: function (x) { return (typeof(x) == 'object'); },
    isFunction: function (x) { return (typeof(x) == 'function'); }
  };


  // Comparison operation
  var ComparisonOperations = {
    $eq: '==',
    $ne: '!=',
    $gt: '>',
    $lt: '<',
    $gte: '>=',
    $lte: '<='
  };

  var ComparisonOperator = (function () {
    var ComparisonOperator = function (key, value, operation) {
      this.key = key;
      this.value = value;
      if (operation == undefined) operation = '$eq';
      this.operation = operation;
    }
    
    ComparisonOperator.prototype.build = function () {
      var valueExpr = $format('{0}', this.value);
      if (Types.isString(this.value)) {
        valueExpr = "'" + valueExpr + "'";
      }
      
      var op = ComparisonOperations[this.operation];
      if (op == ComparisonOperations.$eq || op == ComparisonOperations.$ne) {
        // include array and object condition
        var revOp = (function () {
          if (op == ComparisonOperations.$eq) return ComparisonOperations.$ne
          else                                return ComparisonOperations.$eq
        })();
        return $format(
          "(function () { if (x['{key}'] instanceof Array) { return x['{key}'].indexOf({value}) {arrayOp} -1 } else { return x['{key}'] {valueOp} {value} } })()",
          {
            key: this.key,
            value: valueExpr,
            valueOp: op,
            arrayOp: revOp
          }
        );
      } else {
        return $format(
          "x['{key}'] {op} {value}",
          {
            key: this.key,
            value: valueExpr,
            op: op
          }
        );
      }
    }
    
    return ComparisonOperator;
  })();


  // Logical operation
  var LogicalOperations = {
    $and: ' && ',
    $or: ' || '
  };
  
  var LogicalOperator = (function () {
    var LogicalOperator = function (operators, operation) {
      this.operators = operators;
      if (operation == undefined) operation = '$and';
      this.operation = operation;
    }
    
    LogicalOperator.prototype.build = function () {
      var exprs = [];
      $.each(this.operators, function () {
        exprs.push(this.build());
      });
      if (exprs.length <= 1) {
        return exprs[0];
      } else {
        return $format('({0})', exprs.join(LogicalOperations[this.operation]));
      }
    }
    
    return LogicalOperator;
  })();


  // In, NotIn operation
  var InOperations = {
    $in: '!=',
    $nin: '=='
  };
  
  var InOperator = (function () {
    var InOperator = function (key, values, operation) {
      if (!Types.isArray(values)) throw new TypeError(values + ' is not Array.');
      this.key = key;
      this.values = values;
      this.operation = operation;
    }
    
    InOperator.prototype.build = function () {
      return $format(
        "(jQuery.inArray(x['{0}'], {1}) {2} -1)",
        this.key, JSON.stringify(this.values), InOperations[this.operation]
      );
    }
  
    return InOperator;
  })();
  
  // operator builder
  var OperatorBuilder = {
    buildQueryOperator: function(expression) {
      function build(key, value, op) {
        if (key == '$or') {
          var orOps = [];
          for (var i = 0; i < value.length; i++) {
            for (var orKey in value[i]) {
              orOps.push(build(orKey, value[i][orKey]));
            }
          }
          return new LogicalOperator(orOps, '$or');
        } else if (op == '$in' || op == '$nin') {
          return new InOperator(key, value, op);
        } else {
          if (Types.isObject(value)) {
            var andOps2 = [];
            for (var key2 in value) {
              andOps2.push(build(key, value[key2], key2));
            }
            return new LogicalOperator(andOps2);
          }
        
          return new ComparisonOperator(key, value, op);
        }
      }
    
      var andOps = [];
      for (var key in expression) {
        andOps.push(build(key, expression[key]));
      }
      var andOperator = new LogicalOperator(andOps);
      return andOperator.build();
    },
    
    createQueryFunction: function(expression) {
      var body = OperatorBuilder.buildQueryOperator(expression);
      return new Function('x', 'return ' + body);
    }
  };
  
  $.dbOps = {
    Builder: OperatorBuilder,
    Comparison: ComparisonOperator,
    Logical: LogicalOperator,
    In: InOperator
  }
  
  var defaultDbOptions = {
    storage: window.localStorage,
    get: function (key) {
      var result = this.storage.getItem(PREFIX + key);
      if (result == null) {
        return [];
      } else {
        return JSON.parse(result);
      }
    },
    set: function (key, value) {
      if (Types.isString(value)) {
        this.storage.setItem(PREFIX + key, value);
      } else {
        this.storage.setItem(PREFIX + key, JSON.stringify(value));
      }
    }
  };
  
  var defaultOptions = {
    limit: 0,
    skip: 0
  };
  
  var $db = function (name, dbOption) {
    var db = $.extend(defaultDbOptions, dbOption);
    return {
      PREFIX: PREFIX,
      find: function (query, fields, options) {
        var options = $.extend(defaultOptions, options);
      
        var oldValue = db.get(name);
        if (oldValue === null) return [];
        if (oldValue.length <= 0) return [];
        
        var newValue = [];
        if (query != undefined) {
          var f = OperatorBuilder.createQueryFunction(query);
          $.each(oldValue, function(idx, data){
            if (!f(data)) return true; //continue;
            
            if (options.skip > 0) {
              options.skip--;
              return true; // continue
            }

            newValue.push(data);
            
            if (options.limit == newValue.length) return false; //break
          });
        } else {
          newValue = oldValue;
        }
        
        return newValue;
      },

      findOne: function(query, fields, options) {
        var options = $.extend(options, {limit: 1});
        return this.find(query, fields, options);
      },
      
      count: function(query, options) {
        var options = $.extend(defaultOptions, options);
      
        var oldValue = db.get(name);
        if (oldValue == null) return 0;
        if (oldValue.length <= 0) return 0;
        
        if (query == undefined) return oldValue.length;
        
        var count = 0;
        var f = OperatorBuilder.createQueryFunction(query);
        $.each(oldValue, function (idx, data) {
          if (f(data)) count++;
        });
        
        return count;
      },

      insert: function(value, options) {
        var options = $.extend(defaultOptions, options);
        var arr = db.get(name);
        if (Types.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            arr.push(value[i]);
          }
        } else {
          arr.push(value);
        }
        db.set(name, arr);
      },
      
      remove: function(query) {
        var oldValue = db.get(name);
        if (query == undefined || JSON.stringify(query) == '{}') {
          db.set(name, []);
          return;
        }
        
        var f = OperatorBuilder.createQueryFunction(query);
        for (var i = oldValue.length - 1; i >= 0; i--) {
          if (f(oldValue[i])) oldValue.splice(i, 1);
        }
        
        db.set(name, oldValue);
      },
      
      drop: function () {
        db.storage.removeItem(PREFIX + name);
      }
    }
  }
  
  $.db = function(name, options) {
    return $db(name, options)
  }
  
  $.sessionDb = function(name) {
    var sessionDbOptions = {
      storage: window.sessionStorage
    };
    return $db(name, sessionDbOptions);
  }
})(jQuery);
