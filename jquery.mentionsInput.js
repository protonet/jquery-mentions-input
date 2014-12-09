/*
 * Mentions Input
 *
 * Written by: Christopher Blum (Protonet)
 * Inspired by: Kenneth Auchenberg (Podio)
 *
 * Using underscore.js, jQuery
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */

(function ($, _, root, undefined) {

  // Settings
  var $window = $(window);
  var KEY = { BACKSPACE : 8, TAB : 9, RETURN : 13, ESC : 27, LEFT : 37, UP : 38, RIGHT : 39, DOWN : 40, HOME : 36, END : 35, SPACE: 32 }; // Keys "enum"
  var defaultSettings = {
    minChars      : 1,
    forcePos      : null,
    classes       : {
      autoCompleteItemActive: "selected"
    },
    templates     : {
      wrapper          : _.template('<div class="mentions-wrapper"></div>'),
      caretCalculator  : _.template('<div class="mentions-caret-calculator"></div>'),
      suggestionList   : _.template('<div class="mentions-suggestions-list"></div>'),
      suggestionItem   : _.template('<li><%= content %></li>'),
      mentionsOverlay  : _.template('<div class="mentions"></div>')
    }
  };

  var defaultTriggerSettings = {
    fetch               : $.noop,
    mentionItemSyntax   : _.template('@[<%= value %>](<%= id %>)'),
    mentionItemHighlight: _.template('<strong><%= value %></strong>')
  };

  var utils = {
    htmlEncode       : function (str) {
      return _.escape(str);
    },
    setCaretPosition : function (domNode, caretPos) {
      if (domNode.selectionStart) {
        domNode.focus();
        domNode.setSelectionRange(caretPos, caretPos);
      } else {
        domNode.focus();
      }
    },
    rtrim: function(string) {
      return string.replace(/\s+$/, "");
    }
  };


  function _copyStyles(styles, $from, $to) {
    _.each(styles, function(style) {
      $to.css(style, $from.css(style));
    });
  }







  var MentionsInput = function(input, settings) {
    this.$input = $(input);
    this.settings = $.extend(true, {}, defaultSettings, settings);
    this.triggers = {};
    this.mentions = {};
    this.buffer = [];
    this.suggestions = [];
    this.currentDataQuery = "";
    this.$activeItem = null;


    this.initInput();
    this.initWrapper();
    this.initMentions();
  };


  MentionsInput.prototype = {
    add: function(trigger, triggerSettings) {
      this.triggers[trigger] = $.extend({}, defaultTriggerSettings, triggerSettings);
      this.mentions[trigger] = [];
    },

    initWrapper: function() {
      var hasFocus = this.$input.is(":focus");

      this.$wrapper = $(this.settings.templates.wrapper());

      this.$input.wrap(this.$wrapper);
      this.$wrapper = this.$input.parent();
      
      this.$wrapper.css({
        position:   "relative",
        boxSizing:  "border-box",
        width:      this.$input.outerWidth()
      });

      _copyStyles([
        "display",
        "backgroundColor",
        "backgroundImage",
        "backgroundRepeat",
        "backgroundSize",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderTopStyle",
        "borderRightStyle",
        "borderBottomStyle",
        "borderLeftStyle",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor"
      ], this.$input, this.$wrapper);

      this.$input.css({
        border:     "none",
        background: "transparent"
      });

      if (hasFocus) {
        this.$input.focus();
      }
    },

    initCaretCalculator: function() {
      if (this.$caretCalculator) {
        return;
      }
      this.$caretCalculator = $(this.settings.templates.caretCalculator());

      this.$caretCalculator.css({
        top:        0,
        left:       0,
        right:      0,
        bottom:     0,
        position:   "absolute",
        whiteSpace: "pre-wrap",
        wordWrap:   "break-word",
        display:    "none"
      });

      _copyStyles([
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "overflow",
        "letterSpacing",
        "fontSize",
        "fontFamily",
        "fontStyle",
        "fontWeight",
        "lineHeight",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderTopStyle",
        "borderRightStyle",
        "borderBottomStyle",
        "borderLeftStyle",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor"
      ], this.$input, this.$caretCalculator);

      this.$caretCalculator.appendTo(this.$wrapper);
    },

    initSuggestions: function() {
      if (this.$suggestions) {
        return;
      }

      this.$suggestions = $(this.settings.templates.suggestionList())
        .css({ position: "absolute" })
        .appendTo(this.$wrapper)
        .on("mousedown", "li", this._onSuggestionClick.bind(this));
    },

    initMentions: function() {
      this.$mentions = $(this.settings.templates.mentionsOverlay());

      // TODO add border-radius
      _copyStyles([
        "display",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "overflow",
        "letterSpacing",
        "fontSize",
        "fontFamily",
        "fontStyle",
        "fontWeight",
        "lineHeight",
        "boxSizing"
      ], this.$input, this.$mentions);

      this.$mentions.css({
        top:        0,
        left:       0,
        bottom:     0,
        right:      0,
        color:      "transparent",
        position:   "absolute",
        whiteSpace: "pre-wrap",
        wordWrap:   "break-word"
      });

      if (navigator.userAgent.indexOf("Firefox/") !== -1) {
        this.$mentions.css({
          top:            this.$input.css("paddingTop"),
          right:          this.$input.css("paddingRight"),
          bottom:         this.$input.css("paddingBottom"),
          left:           this.$input.css("paddingLeft"),
          paddingTop:     "",
          paddingRight:   "",
          paddingBottom:  "",
          paddingLeft:    ""
        });
      }

      this.$input.on("scroll", function() {
        this.$mentions.scrollTop(this.$input.scrollTop());
        this.$mentions.scrollLeft(this.$input.scrollLeft());
      }.bind(this));

      this.$mentions.prependTo(this.$wrapper);
    },

    initInput: function() {
      this.$input.css({
        resize:     "none",
        position:   "relative"
      });

      this.$input.on({
        keydown:  this._onKeyDown.bind(this),
        keypress: this._onKeyPress.bind(this),
        input:    this._onInput.bind(this),
        click:    this.resetBuffer.bind(this),
        blur:     this.hideSuggestions.bind(this)
      });
    },

    updateValues: function() {
      var syntaxMessage = this.$input.val();
      _.each(this.mentions, function(mentions, trigger) {
        _.each(mentions, function(mention) {
          var textSyntax = this.triggers[trigger].mentionItemSyntax(mention);
          syntaxMessage = syntaxMessage.replace(mention.value, textSyntax);
        }.bind(this));
      }.bind(this));

      var mentionText = utils.htmlEncode(syntaxMessage);
      _.each(this.mentions, function(mentions, trigger) {
        _.each(mentions, function(mention) {
          var formattedMention = _.extend({}, mention, { value: mention.value });
          var textSyntax = utils.htmlEncode(this.triggers[trigger].mentionItemSyntax(formattedMention));
          formattedMention.value = utils.htmlEncode(formattedMention.value);
          var textHighlight = this.triggers[trigger].mentionItemHighlight(formattedMention);
          mentionText = mentionText.replace(textSyntax, textHighlight);
        }.bind(this));
      }.bind(this));

      // TODO: Adding white-space: pre; might make this obsolete
      mentionText = mentionText.replace(/\n/g, '<br>');
      mentionText = mentionText.replace(/<br>$/g, '<br>&nbsp;');
      mentionText = mentionText.replace(/ {2}/g, '&nbsp; ');

      this.$input.data("messageText", syntaxMessage);
      this.$mentions.html(mentionText);
    },

    resetBuffer: function() {
      this.buffer = [];
    },

    updateMentions: function() {
      var inputText = this.$input.val();
      _.each(this.mentions, function(mentions, trigger) {
        var oldLength = mentions.length;
        mentions = _.reject(mentions, function(mention) {
          return !mention.value || inputText.indexOf(mention.value) == -1;
        });
        mentions = _.compact(mentions);
        var newLength = mentions.length;

        if (oldLength !== newLength) {
          this.mentions[trigger] = mentions;
          this.$input.trigger("mentionremove", [mentions, trigger]);
        }
      }.bind(this));
    },

    addMention: function(trigger, mention) {
      var currentMessage = this.$input.val();
      var fullQuery = trigger + this.currentDataQuery;
      var firstIndex = currentMessage.indexOf(fullQuery, (this.$input[0].selectionEnd || 0) - fullQuery.length);
      var lastIndex = firstIndex + this.currentDataQuery.length + 1;

      var startCaretPosition = firstIndex;
      var currentCaretPosition = lastIndex;

      var start = currentMessage.substr(0, startCaretPosition);
      var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
      var startEndIndex = (start + mention.value).length + 1;

      this.mentions[trigger].push(mention);

      // Cleaning before inserting the value, otherwise auto-complete would be triggered with "old" inputbuffer
      this.resetBuffer();
      this.currentDataQuery = "";
      this.hideSuggestions();

      // Mentions & syntax message
      var updatedMessageText = start + mention.value + ' ' + end;
      this.$input.val(updatedMessageText);
      this.updateValues();

      // Set correct focus and selection
      this.$input.focus();
      utils.setCaretPosition(this.$input[0], startEndIndex);

      this.$input.trigger("mentionadd", [this.mentions[trigger], trigger]);
    },

    _onSuggestionClick: function(event) {
      var $target = $(event.currentTarget);
      var mention = this.suggestions[$target.data("uid")];
      this.addMention(this.currentTrigger, mention);
      return false;
    },

    _onInput: function() {
      this.updateValues();
      this.updateMentions();

      for (var triggerChar in this.triggers) {
        var triggerCharIndex = _.lastIndexOf(this.buffer, triggerChar);
        if (triggerCharIndex > -1) {
          this.currentDataQuery = this.buffer.slice(triggerCharIndex + 1).join('');
          this.currentDataQuery = utils.rtrim(this.currentDataQuery);
          _.defer(this.search.bind(this, this.currentDataQuery, triggerChar));
          break;
        }
      }
    },

    _onKeyPress: function(event) {
      if (event.keyCode !== KEY.BACKSPACE) {
        var typedValue = String.fromCharCode(event.which || event.keyCode);
        this.buffer.push(typedValue);
      }
    },

    _onKeyDown: function(event) {
      var keyCode = event.keyCode;
      // This also matches HOME/END on OSX which is CMD+LEFT, CMD+RIGHT
      if (keyCode == KEY.LEFT || keyCode == KEY.RIGHT || keyCode == KEY.HOME || keyCode == KEY.END) {
        // Defer execution to ensure carat pos has changed after HOME/END keys
        _.defer(this.resetBuffer.bind(this));
        return;
      }

      if (keyCode == KEY.BACKSPACE) {
        this.buffer = this.buffer.slice(0, -1 + this.buffer.length); // Can't use splice, not available in IE
        _.defer(this.hideSuggestions.bind(this));
        return;
      }

      if (!this.$suggestions || !this.$suggestions.is(':visible')) {
        return true;
      }

      switch (keyCode) {
        case KEY.UP:
        case KEY.DOWN:
          var $currentAutoCompleteItem = null;
          if (keyCode == KEY.DOWN) {
            if (this.$activeItem && this.$activeItem.length) {
              $currentAutoCompleteItem = this.$activeItem.next();
            } else {
              $currentAutoCompleteItem = this.$suggestions.find("li").first();
            }
          } else {
            $currentAutoCompleteItem = this.$activeItem.prev();
          }

          if ($currentAutoCompleteItem.length) {
            this.selectItem($currentAutoCompleteItem);
          }
          return false;

        case KEY.RETURN:
        case KEY.TAB:
          if (this.$activeItem && this.$activeItem.length) {
            this.$activeItem.trigger("mousedown");
            return false;
          }

          break;

        case KEY.ESC:
          this.hideSuggestions();
          return false;

        case KEY.SPACE:
          var mention = this.suggestions[this.$activeItem.data("uid")];
          if (mention.value.toLowerCase() === (this.currentTrigger + this.currentDataQuery).toLowerCase()) {
            this.$activeItem.trigger("mousedown");
            return false;
          }
      }

      return true;
    },

    hideSuggestions: function() {
      this.$activeItem = null;
      if (this.$suggestions) {
        this.$suggestions.empty().hide();
      }
    },

    showSuggestions: function() {
      this.$suggestions.show();
      var offset = this.getTriggerCharOffset();
      var height = this.$suggestions.outerHeight();
      var width = this.$suggestions.outerWidth();
      var scrollTop = $window.scrollTop();
      var scrollLeft = $window.scrollLeft();
      var windowHeight = $window.height();
      var windowWidth = $window.width();
      var top = offset.top + 20;
      var left = offset.left;

      if ((top + height) > (windowHeight + scrollTop) || this.settings.forcePos === "top") {
        top = offset.top - height;
      }

      if ((left + width) > (windowWidth + scrollLeft)) {
        left = offset.left - width;
      }

      this.$suggestions.offset({ top: top, left: left });
    },

    selectItem: function($item) {
      $item.addClass(this.settings.classes.autoCompleteItemActive);
      $item.siblings().removeClass(this.settings.classes.autoCompleteItemActive);
      this.$activeItem = $item;
    },

    getTriggerCharOffset: function() {
      var val = this.$input.val();
      var pos = val.substr(0, this.$input[0].selectionEnd).lastIndexOf(this.currentTrigger) + this.currentTrigger.length;
      var placeholder = "|-#+#-|";
      val = val.substr(0, pos) + placeholder + val.substr(pos);
      val = utils.htmlEncode(val);
      val = val.replace(placeholder, "<span>.</span>");
      val = val.replace(/\n/g, '<br>');
      val = val.replace(/<br>$/g, '<br>&nbsp;');

      this.initCaretCalculator();

      this.$caretCalculator
        .html(val)
        .show()
        .scrollTop(this.$input.scrollTop())
        .scrollLeft(this.$input.scrollLeft());

      var $position = this.$caretCalculator.find("span");
      var offset = $position.offset();
      $position.remove();
      this.$caretCalculator.hide();

      return offset;
    },

    populateDropdown: function(query, trigger, results) {
      // Filter items that have already been mentioned
      var mentionValues = _.pluck(this.mentions[trigger], 'value');
      results = _.reject(results, function (item) {
        return _.include(mentionValues, item.name);
      });

      if (!results.length) {
        this.hideSuggestions();
        return;
      }

      this.initSuggestions();
      this.$suggestions.empty();

      var $list = $("<ul>").appendTo(this.$suggestions).hide();

      _.each(results, function (item, index) {
        var itemUid = trigger + ":" + (item.id || item.name);

        this.suggestions[itemUid] = _.extend({}, item, { value: item.name });

        var $item = $(this.settings.templates.suggestionItem({
          id      : utils.htmlEncode(item.id),
          content : utils.htmlEncode(item.name)
        })).data("uid", itemUid);

        if (index === 0) {
          this.selectItem($item);
        }
        $item.appendTo($list);
      }.bind(this));

      $list.show();
      
      this.showSuggestions();
    },

    search: function(query, trigger) {
      if (typeof(query) === "string" && query.length >= this.settings.minChars) {
        this.triggers[trigger].fetch.call(this, query, function(responseData) {
          this.currentTrigger = trigger;
          this.populateDropdown(query, trigger, responseData);
        }.bind(this));
      } else {
        this.hideSuggestions();
      }
    },

    reset: function() {
      this.$input.val("");
      this.mentions = {};
      this.updateValues();
      this.$input.trigger("mentionreset");
    },

    val: function() {
      return this.$input.data("messageText") || this.$input.val();
    },

    getMentions: function(trigger) {
      return this.mentions[trigger];
    },

    setMentions: function(trigger, mentions) {
      this.mentions[trigger] = mentions;
      this.resetBuffer();
      this.updateValues();
      if (mentions.length) {
        this.$input.trigger("mentionadd", [this.mentions[trigger], trigger]);
      }
    }
  };

  root.MentionsInput = MentionsInput;

})(jQuery, _, this);