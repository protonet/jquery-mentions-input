module("jquery.mentionsInput");

test("should wrap textfield", function() {
  var $message = $("#message");
  $message.mentionsInput();
  
  ok($message.parent().is(".mentions-wrapper"), "has wrapper");
  ok($message.parent().find(".mentions").length, "has mentions overlay");
});

test("should copy styles from textfield to mentions layer", function() {
  var $message = $("#message");
  
  $message.css({
    "font-size": "21px",
    "line-height": "30px",
    "width": "322px",
    "padding": "10px",
    "border": "3px solid red"
  });
  
  $message.mentionsInput();
  
  var $wrapper = $message.parent();
  var $mentionsLayer = $wrapper.find(".mentions");
  
  equal($message.css("font-size"), $mentionsLayer.css("font-size"), "same font-size");
  equal($message.css("line-height"), $mentionsLayer.css("line-height"), "same line-height");
  
  if (navigator.userAgent.indexOf("Firefox/") !== -1) {
    equal($message.outerWidth(), $mentionsLayer.outerWidth() + 20 /* padding-left + padding-right */, "same width");
  } else {
    equal($message.outerWidth(), $mentionsLayer.outerWidth(), "same width");
  }
});


test("should sync textarea with mentions overlay", function() {
  var $message = $("#message");
  
  $message.mentionsInput();
  var $wrapper = $message.parent();
  var $mentionsLayer = $wrapper.find(".mentions");
  
  equal($mentionsLayer.text(), $message.val(), "same val");
  
  $message.val("foo\nbar").trigger("input");
  
  equal($mentionsLayer.html().toLowerCase(), "foo<br>bar", "correctly turned \\n into <br>");

  $message.val("foo\nbar  ").trigger("input");
  
  equal($mentionsLayer.html().toLowerCase(), "foo<br>bar&nbsp; ", "correctly transformed double white space");
});

asyncTest("autocompleter list is correctly toggled when query matches", function() {
  expect(5);
  
  var $message = $("#message");
  
  $message.mentionsInput({
    onDataRequest: function(query, callback) {
      equal(query, "s", "correct query passed into callback");
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  var $autocompleterList = $wrapper.find(".mentions-autocomplete-list");
  
  ok($autocompleterList.is(":hidden"), "list is initially hidden");
  
  $.each("hello @s".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    ok($autocompleterList.is(":visible"), "list is visible after query matches");
    equal($autocompleterList.find("li").length, 1, "1 result is listed");

    equal($autocompleterList.find("li").text(), "Spongebob Squarepants", "Correct content is rendered into the list");
    
    start();
  });
});

test("ensures that focus on input/textarea is preserved when initializing", function() {
  var $message = $("#message");
  
  $message.focus();
  $message.mentionsInput();
  
  ok($message.is(":focus"));
});


asyncTest("autocompleter triggers mentionadd event", function() {
  expect(2);
  
  var $message = $("#message");
  
  $message.mentionsInput({
    onDataRequest: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  var $autocompleterList = $wrapper.find(".mentions-autocomplete-list");
  
  $.each("hello @s".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    $message.on("mentionadd", function(event, mentions) {
      ok(true, "mention added");
      deepEqual(mentions, [{ name: "Spongebob Squarepants", id: 7, value: "Spongebob Squarepants" }], "Proper mentions array passed into event handler");
      start();
    });
    
    $autocompleterList.find("li").mousedown();
  });
});

asyncTest("autocompleter triggers mentionremove event", function() {
  expect(2);
  
  var $message = $("#message");
  
  $message.mentionsInput({
    onDataRequest: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  var $autocompleterList = $wrapper.find(".mentions-autocomplete-list");
  
  $.each("hello @s".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    $autocompleterList.find("li").mousedown();
    
    $message.on("mentionremove", function(event, mentions) {
      ok(true, "mention removed");
      deepEqual(mentions, [], "Proper mentions array passed into event handler");
      start();
    });
    
    $message.val("").trigger("input");
  });
});

test("reset triggers mentionreset event", function() {
  
  var $message = $("#message"); 
  $message.mentionsInput({
    onDataRequest: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  $message.on("mentionreset", function(event, mentions) {
    ok(true, "mention reset");
    deepEqual(mentions, [], "Proper mentions array passed into event handler");
  });
  
  $message.mentionsInput("reset");  
});
