(function(){
  "use strict";
  const failures=[];

  function fail(message){ throw new Error(message); }

  function render(){
    const results=document.querySelector("#test-results");
    if(!results) return;
    results.dataset.complete="true";
    results.dataset.failures=String(failures.length);
    results.textContent=failures.length ? failures.join("\n") : "All tests passed.";
  }

  function same(actual, expected){
    if(Object.is(actual,expected)) return true;
    if(!actual || !expected || typeof actual!=="object" || typeof expected!=="object") return false;
    const actualKeys=Object.keys(actual).sort();
    const expectedKeys=Object.keys(expected).sort();
    if(actualKeys.length!==expectedKeys.length) return false;
    return actualKeys.every((key,index)=>key===expectedKeys[index] && same(actual[key],expected[key]));
  }

  window.GymTests={
    test(name, fn){
      try{ fn(); }
      catch(error){ failures.push(`${name}: ${error && error.message ? error.message : String(error)}`); }
    },
    assert(value, message="Expected value to be truthy"){
      if(!value) fail(message);
    },
    equal(actual, expected, message){
      if(actual!==expected) fail(message || `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    },
    deepEqual(actual, expected, message){
      if(!same(actual, expected)) fail(message || `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    },
    closeTo(actual, expected, tolerance, message){
      if(Math.abs(actual-expected)>tolerance) fail(message || `Expected ${expected} ± ${tolerance}, received ${actual}`);
    },
    finish:render,
  };
})();
