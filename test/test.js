module("jquery.mentionsInput");

test("should wrap textfield", function() {
  var $message = $("#message");
  
  new MentionsInput($message);
  
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
  
  new MentionsInput($message);
  
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
  
  new MentionsInput($message);
  
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
  
  var mentionsInput = new MentionsInput($message);
  mentionsInput.add("@", {
    fetch: function(query, callback) {
      equal(query, "s", "correct query passed into callback");
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  ok(!$wrapper.find(".mentions-suggestions").length, "list is initially not existing");
  
  $.each("hello @s".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    var $autocompleterList = $wrapper.find(".mentions-suggestions");
    ok($autocompleterList.is(":visible"), "list is visible after query matches");
    equal($autocompleterList.find("li").length, 1, "1 result is listed");

    equal($autocompleterList.find("li").text(), "Spongebob Squarepants", "Correct content is rendered into the list");
    
    start();
  });
});

asyncTest("autocompleter works with minChars: 0", function() {
  expect(4);
  
  var $message = $("#message");
  
  var mentionsInput = new MentionsInput($message, {
    minChars: 0
  });
  
  mentionsInput.add(":", {
    fetch: function(query, callback) {
      equal(query, "", "correct query passed into callback");
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  
  $.each("hello :".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    var $autocompleterList = $wrapper.find(".mentions-suggestions");
    
    ok($autocompleterList.is(":visible"), "list is visible after query matches");
    equal($autocompleterList.find("li").length, 1, "1 result is listed");

    equal($autocompleterList.find("li").text(), "Spongebob Squarepants", "Correct content is rendered into the list");
    
    start();
  });
});

test("ensures that focus on input/textarea is preserved when initializing", function() {
  var $message = $("#message");
  
  $message.focus();
  new MentionsInput($message);
  ok($message.is(":focus"));
});


asyncTest("autocompleter triggers mentionadd event", function() {
  expect(2);
  
  var $message = $("#message");
  
  var mentionsInput = new MentionsInput($message);
  mentionsInput.add("@", {
    fetch: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  
  $.each("hello @s".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    $message.on("mentionadd", function(event, mentions, trigger) {
      ok(true, "mention added");
      deepEqual(mentions, [{ name: "Spongebob Squarepants", id: 7, value: "Spongebob Squarepants" }], "Proper mentions array passed into event handler");
      start();
    });

    var $autocompleterList = $wrapper.find(".mentions-suggestions");
    $autocompleterList.find("li").mousedown();
  });
});

asyncTest("autocompleter triggers mentionremove event", function() {
  expect(2);
  
  var $message = $("#message");
  
  var mentionsInput = new MentionsInput($message);
  mentionsInput.add("@", {
    fetch: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var $wrapper = $message.parent();
  
  $.each("hello @s".split(""), function(i, character) {
    var $keypress = $.Event("keypress", {
      keyCode: character.charCodeAt(0)
    });
    
    $message.trigger($keypress);
    $message.val($message.val() + character).trigger("input");
  });
  
  _.defer(function() {
    var $autocompleterList = $wrapper.find(".mentions-suggestions");
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
  $message.on("mentionreset", function(event, mentions) {
    ok(true, "mention reset");
  });
  var mentionsInput = new MentionsInput($message);
  mentionsInput.add("@", {
    fetch: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  mentionsInput.reset();
});


test("setMentions triggers mentionadd event", function() {
  
  var $message = $("#message");
  var mentionsInput = new MentionsInput($message);
  mentionsInput.add("@", {
    fetch: function(query, callback) {
      callback([{ name: "Spongebob Squarepants", id: 7 }]);
    }
  });
  
  var collection = [{ name: "Spongebob Squarepants", id: 7, value: "Spongebob Squarepants" }];
  
  $message.on("mentionadd", function(e, mentions) {
    equal(collection, mentions, "Proper mentions array passed into mentionadd event handler");
  });
  
  mentionsInput.setMentions("@", collection);
});
