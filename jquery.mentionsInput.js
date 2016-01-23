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
      suggestionList   : _.template('<div class="mentions-suggestions"></div>'),
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
      domNode.focus();
      if ("selectionStart" in domNode) {
        domNode.selectionStart = caretPos;
        domNode.selectionEnd = caretPos;
      }
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
    this.suggestions = [];
    this.currentDataQuery = "";
    this.$activeItem = null;

    this.initInput();
    this.initWrapper();
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
      if (this.$mentions) {
        return;
      }

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
        resize:   "none",
        position: "relative"
      });

      this.$input.on({
        keydown:  this._onKeyDown.bind(this),
        input:    this._onInput.bind(this),
        blur:     this.hideSuggestions.bind(this)
      });
    },

    updateValues: function() {
      var syntaxMessage = this.$input.val();
      _.each(this.mentions, function(mentions, trigger) {
        _.each(mentions, function(mention) {
          var textSyntax = this.triggers[trigger].mentionItemSyntax(mention);
          syntaxMessage = syntaxMessage.split(mention.value).join(textSyntax);
        }.bind(this));
      }.bind(this));

      var mentionText = utils.htmlEncode(syntaxMessage);
      _.each(this.mentions, function(mentions, trigger) {
        _.each(mentions, function(mention) {
          var formattedMention = _.extend({}, mention, { value: mention.value });
          var textSyntax = utils.htmlEncode(this.triggers[trigger].mentionItemSyntax(formattedMention));
          formattedMention.value = utils.htmlEncode(formattedMention.value);
          var textHighlight = this.triggers[trigger].mentionItemHighlight(formattedMention);
          mentionText = mentionText.split(textSyntax).join(textHighlight);
        }.bind(this));
      }.bind(this));

      this._val = syntaxMessage;
      this.initMentions();
      this.$mentions.html(mentionText + "\n");
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
      var updatedMessageText = start + mention.value + ' ' + end;
      var startEndIndex = (start + mention.value).length + 1;

      this._add(trigger, mention, updatedMessageText, startEndIndex);
    },

    _add: function(trigger, mention, newMessage, caretPosition) {
      if (!this._hasMention(trigger, mention)) {
        this.mentions[trigger].push(mention);
      }

      this.currentDataQuery = "";
      this.hideSuggestions();

      this.$input.val(newMessage);
      this.updateValues();

      // Set correct focus and selection
      this.$input.focus();
      utils.setCaretPosition(this.$input[0], caretPosition);

      this.$input.trigger("mentionadd", [this.mentions[trigger], trigger]);
    },

    _hasMention: function(trigger, mentionToSearch) {
      return _.find(this.mentions[trigger], function(mention) {
        return mention.value === mentionToSearch.value;
      });
    },

    insert: function(trigger, mention) {
      var currentMessage = this.$input.val();
      var selectionEnd = this.$input[0].selectionEnd;
      var start = currentMessage.substr(0, selectionEnd);
      var end = currentMessage.substr(selectionEnd);
      var updatedMessageText = start + mention.value + ' ' + end;
      var startEndIndex = (start + mention.value).length + 1;

      this._add(trigger, mention, updatedMessageText, startEndIndex);
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

      var val = this.$input.val();
      var buffer = val.substr(0, this.$input[0].selectionStart);

      var indexes = _.map(this.triggers, function(config, trigger) {
        return buffer.lastIndexOf(trigger);
      });

      var triggerCharIndex = Math.max.apply(Math, indexes);
      var triggerChar = buffer.charAt(triggerCharIndex);
      var previousChar = buffer.charAt(triggerCharIndex - 1);

      if (previousChar && !previousChar.match(/\s|\(|\[/)) {
        triggerCharIndex = buffer.lastIndexOf(this.currentTrigger, triggerCharIndex - 1);
      }

      if (triggerCharIndex > -1) {
        this.currentDataQuery = buffer.slice(triggerCharIndex + 1);
        _.defer(this.search.bind(this, this.currentDataQuery, triggerChar));
      }
    },

    _onKeyDown: function(event) {
      var keyCode = event.keyCode;
      if (keyCode == KEY.BACKSPACE) {
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
          if (this.$activeItem && this.$activeItem.length && !event.shiftKey && !event.altKey) {
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

        if (item.icon) {
          $("<img>", { src: item.icon }).prependTo($item);
        }

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

      _.each(this.mentions, function(arr, trigger) {
        this.mentions[trigger] = [];
      }.bind(this));

      this.updateValues();
      _.each(this.triggers, function(trigger, char) {
        this.$input.trigger("mentionreset", [[], char]);
      }.bind(this));
    },

    val: function() {
      return this._val || this.$input.val();
    },

    getMentions: function(trigger) {
      return trigger ? this.mentions[trigger] : this.mentions;
    },

    setMentions: function(trigger, mentions) {
      this.mentions[trigger] = mentions;
      this.updateValues();
      if (mentions.length) {
        this.$input.trigger("mentionadd", [this.mentions[trigger], trigger]);
      }
    }
  };

  root.MentionsInput = MentionsInput;

})(jQuery, _, this);