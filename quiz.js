/*-----------------------------------------------------------------------------/
  / Coffee Quiz
  git: https://github.com/onyxrev/pakt_quiz
  /-----------------------------------------------------------------------------*/

var PaktQuiz = function(options) {
  this.questions = [];
  this.assetBaseUrl = options.assetBaseUrl;

  var lines = options.quizCopy.split("\n"),
      questionLines = [],
      i,
      line;

  for (i = 0; i < lines.length; i++) {
    line = PaktQuiz.escapeHTML(lines[i]);

    if (
      (PaktQuiz.startsWithNumber(line) && // new question?
       questionLines.length !== 0) || // not first question?
	i == lines.length - 1 // last question?
    ) {
      if (i == lines.length - 1) questionLines.push(line); // last question

      // we've discovered a whole question. initialize the question
      this.questions.push(
	new PaktQuiz.Question(
	  questionLines.join("\n"),
	  this,
	  this.questions.length
	)
      );

      // start the buffer for the next question
      questionLines = [line];
    } else if (line == "") {
      // empty line
      continue;
    } else {
      // not a new question, so add line to the current question
      questionLines.push(line);
    }
  }
};

PaktQuiz.transitionTime = 500; // milliseconds
PaktQuiz.mobileBreakpoint = 780; // px
PaktQuiz.waitingAnimationTime = 3000; // milliseconds

PaktQuiz.startsWithNumberMatcher = new RegExp("^[0-9]+.? ");
PaktQuiz.startsWithNumber = function(line) {
  return line.match(PaktQuiz.startsWithNumberMatcher) !== null;
};

PaktQuiz.escapeHTML = function(line) {
  return line
    .trim()
    .replace(/“|”/g, '"')
    .replace(/’/g, "'")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/…/g, "...")
    .replace(/&amp;#039;/g, "'");
};

PaktQuiz.normalizeHTML = function(line) {
  return line
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
};

PaktQuiz.getQueryStrings = function() {
  var assoc = {};
  var decode = function(s) {
    return decodeURIComponent(s.replace(/\+/g, " "));
  };
  var queryString = location.search.substring(1);
  var keyValues = queryString.split("&");

  for (var i in keyValues) {
    var key = keyValues[i].split("=");
    if (key.length > 1) {
      assoc[decode(key[0])] = decode(key[1]);
    }
  }

  return assoc;
};

PaktQuiz.prototype.render = function(container) {
  var quiz = this;

  this.container = container;
  PaktQuiz.addClass(this.container, "pakt-quiz-container");

  this.element = document.createElement("ol");
  this.element.id = "pakt_quiz";

  var i;
  for (i = 0; i < this.questions.length; i++) {
    this.element.appendChild(this.questions[i].render());
  }

  this.resultsContainer = document.createElement("div");
  this.resultsContainer.id = "pakt_quiz_results";
  this.container.appendChild(this.resultsContainer);

  setTimeout(
    function() {
      this.forwardToQuestion(0);
    }.bind(this),
    0
  );

  return this.element;
};

PaktQuiz.prototype.grade = function() {
  var i,
      points = 0,
      resultsSet = [],
      result;
  for (i = 0; i < this.questions.length; i++) {
    result = this.questions[i].serialize();
    points += this.questions[i].serialize(result).reduce(function(a, b) {
      return a + b;
    }, 0);
    resultsSet.push(result);
  }

  var estimate;
  for (var i = 0; i < this.questions.length; i++) {
    if (
      this.questions[i].text.indexOf("what would you rate your level") !== -1
    ) {
      estimate = this.questions[i].serialize()[0];
    }
  }

  var level = this.results.findLevel(points);
  this.resultsContainer.innerHTML = ""; // empty it
  this.resultsContainer.appendChild(level.render(resultsSet, estimate));

  var newsletter = new PaktQuiz.Newsletter();
  this.resultsContainer.appendChild(newsletter.render(level));

  var newUrl =
      window.location.href.split("?")[0] +
      PaktQuiz.resultsQueryString(resultsSet);
  window.history.pushState({ path: newUrl }, "", newUrl);

  setTimeout(
    function() {
      this.showWaitingAnimation();
      this.questions[this.currentQuestion].demote(0);
      level.element.style.top = "0";
    }.bind(this),
    0
  );

  setTimeout(function(){
    KlaviyoSubscribe.attachToForms('#nlFormQuiz', {
      hide_form_on_success: true,
      success_message: "Thank you for signing up!",
      extra_properties: {
        $source: 'Shopify',
        Brand: 'Klaviyo'
      }
    });
  },500);


};

PaktQuiz.prototype.showWaitingAnimation = function() {
  var waiting = document.createElement("div");
  PaktQuiz.addClass(waiting, "pakt-quiz-waiting-container");

  var img = document.createElement("div");
  PaktQuiz.addClass(img, "pakt-quiz-waiting-image");
  img.style.backgroundImage =
    "url('" + this.assetBaseUrl + "images/waiting_animation.gif')";
  waiting.appendChild(img);

  var text = document.createElement("h3");
  PaktQuiz.addClass(text, "pakt-quiz-waiting-text");
  text.innerHTML = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(
      document.getElementById("pakt_results_waiting_message").innerHTML.trim()
    )
  );
  img.appendChild(text);

  this.container.appendChild(waiting);

  setTimeout(
    function() {
      PaktQuiz.addClass(this.element, "pakt-quiz-hidden");
      this.container.removeChild(waiting);
      window.scrollTo(0, 0);
    }.bind(this),
    PaktQuiz.waitingAnimationTime
  );
};

PaktQuiz.prototype.forwardToQuestion = function(questionIndex) {
  var currentQuestion = this.currentQuestion;
  this.currentQuestion = questionIndex;

  if (currentQuestion == 0 || !!currentQuestion) {
    this.questions[currentQuestion].demote();
  }

  this.questions[questionIndex].promote();
};

PaktQuiz.prototype.backwardToQuestion = function(questionIndex) {
  var currentQuestion = this.currentQuestion;
  this.currentQuestion = questionIndex;

  if (currentQuestion == 0 || !!currentQuestion) {
    this.questions[currentQuestion].demote(true);
  }

  this.questions[questionIndex].promote(true);
};

PaktQuiz.prototype.scrollTo = function(questionIndex) {
  // only scroll for "mobile"
  if (document.body.clientWidth > PaktQuiz.mobileBreakpoint) return;

  var position = this.questions[questionIndex].element.offsetTop;
  window.scroll({ top: position, left: 0, behavior: "smooth" });
};

PaktQuiz.encodeResults = function(resultsSet) {
  var out = [];
  for (var i = 0; i < resultsSet.length; i++) {
    out.push(resultsSet[i].join(","));
  }
  return out.join(";");
};

PaktQuiz.decodeResults = function(codedResults) {
  var out = [];
  var questions = codedResults.split(";");
  for (var i = 0; i < questions.length; i++) {
    out.push(questions[i].split(","));
  }

  return out;
};

PaktQuiz.baseUrl = document.getElementById("pakt_quiz_url").innerHTML.trim();
PaktQuiz.shareUrl = function(resultsSet) {
  return PaktQuiz.baseUrl + PaktQuiz.resultsQueryString(resultsSet);
};
PaktQuiz.resultsQueryString = function(resultsSet) {
  return ""; // Pakt requested to disable the results feature for now
  return "?results=" + PaktQuiz.encodeResults(resultsSet);
};

PaktQuiz.Question = function(questionAndChoices, quiz, index) {
  this.choices = [];
  this.quiz = quiz;
  this.index = index;
  this.selection = null;
  this.scaleMin = null;
  this.scaleMax = null;

  var lines = questionAndChoices.split("\n"),
      numberAndQuestion = lines.shift().trim(),
      extracted = numberAndQuestion.match(PaktQuiz.Question.extractor);

  this.number = parseInt(extracted[1]) - 1;
  this.text = extracted[2].trim();

  var textAndImage = this.text.match(PaktQuiz.Question.imageFilenameExtractor);
  if (textAndImage) {
    this.text = textAndImage[1];
    this.imageFilename = textAndImage[2];
    this.imageName = textAndImage[2].match(
      PaktQuiz.Question.imageNameExtractor
    )[1];
  }

  this.detectType();

  var i, line, choice;
  for (i = 0; i < lines.length; i++) {
    line = lines[i];
    if (line.trim() == "") continue;
    this.choices.push(new PaktQuiz.Choice(line, this, i));
  }
};

PaktQuiz.prototype.populateResults = function(resultsSet) {
  var question, input;

  for (var i = 0; i < resultsSet.length; i++) {
    question = this.questions[i];
    if (question) {
      for (var n = 0; n < resultsSet[i].length; n++) {
	input = question.element.querySelectorAll(
	  'input[value="' + resultsSet[i][n] + '"]'
	);
	if (input[0]) input[0].checked = true;
      }

      question.onChange();
    }
  }

  this.grade();
};

PaktQuiz.Question.scaleExtractor = new RegExp("a scale of ([0-9]+)-([0-9]+)");
PaktQuiz.Question.prototype.detectType = function() {
  var scaleExtracted = this.text.match(PaktQuiz.Question.scaleExtractor);

  if (scaleExtracted !== null) {
    this.type = "scale";
    this.scaleMin = parseInt(scaleExtracted[1], 10);
    this.scaleMax = parseInt(scaleExtracted[2], 10);
  } else {
    this.type = "multiple_choice";
  }
};

PaktQuiz.Question.extractor = new RegExp("^([0-9]*).? (.*)$");
PaktQuiz.Question.imageFilenameExtractor = new RegExp("(.*) Image: ?(.*),?");
PaktQuiz.Question.imageNameExtractor = new RegExp("(.*).{4}$");

PaktQuiz.Question.prototype.render = function() {
  var quizHeight = document.body.clientHeight;
  this.element = document.createElement("li");
  this.element.style.transition =
    "top " + PaktQuiz.transitionTime / 1000 + "s" + "ease 0s";
  this.element.style.top = quizHeight + "px";

  var promptContainer = document.createElement("div");
  PaktQuiz.addClass(promptContainer, "pakt-quiz-question-prompt-container");
  PaktQuiz.addClass(promptContainer, "pakt-quiz-image-" + this.imageName);

  var responseContainer = document.createElement("div");
  PaktQuiz.addClass(responseContainer, "pakt-quiz-question-response-container");

  var intermediateResponseContainer = document.createElement("div");
  responseContainer.appendChild(intermediateResponseContainer);

  promptContainer.appendChild(this.renderPrompt());
  promptContainer.appendChild(this.renderImage());

  var choicesContainer = document.createElement("div");
  PaktQuiz.addClass(choicesContainer, "pakt-quiz-question-choices");

  PaktQuiz.addClass(this.element, "pakt-quiz-question");

  switch (this.type) {
  case "multiple_choice":
    PaktQuiz.addClass(this.element, "pakt-quiz-multiple-choice");
    choicesContainer.appendChild(this.renderAsMultipleChoice());
    break;
  case "scale":
    PaktQuiz.addClass(this.element, "pakt-quiz-scale");
    choicesContainer.appendChild(this.renderAsScale());
    break;
  }

  if (this.index !== 0) {
    intermediateResponseContainer.appendChild(this.renderPreviousButton());
  }

  intermediateResponseContainer.appendChild(choicesContainer);

  if (this.index === 0) {
    this.retortElement = this.renderRetort();
    intermediateResponseContainer.appendChild(this.retortElement);
  }

  if (this.index !== this.quiz.questions.length - 1) {
    this.nextButton = this.renderNextButton();
    intermediateResponseContainer.appendChild(this.nextButton);
  } else {
    this.nextButton = this.renderGradeButton();
    intermediateResponseContainer.appendChild(this.nextButton);
  }

  this.element.appendChild(promptContainer);
  this.element.appendChild(responseContainer);

  return this.element;
};

PaktQuiz.Question.prototype.renderPrompt = function() {
  var strong = document.createElement("strong");

  PaktQuiz.addClass(strong, "pakt-quiz-question-prompt");
  strong.innerHTML = PaktQuiz.normalizeHTML(this.text);

  return strong;
};

PaktQuiz.Question.prototype.renderRetort = function() {
  var strong = document.createElement("p");

  PaktQuiz.addClass(strong, "pakt-quiz-question-retort");
  strong.innerHTML = PaktQuiz.normalizeHTML("We'll see about that...");

  return strong;
};

PaktQuiz.Question.prototype.renderAsMultipleChoice = function() {
  var div = document.createElement("div"),
      i;
  PaktQuiz.addClass(div, "pakt-quiz-question-type-multiple-choice");
  for (i = 0; i < this.choices.length; i++) {
    div.appendChild(this.choices[i].render(this.onChange.bind(this)));
  }

  return div;
};

PaktQuiz.Question.prototype.onChange = function() {
  PaktQuiz.addClass(this.nextButton, "pakt-quiz-visible");

  if (this.retortElement) {
    PaktQuiz.addClass(this.retortElement, "pakt-quiz-visible");
  }
};

PaktQuiz.Question.prototype.renderAsScale = function() {
  var div = document.createElement("div"),
      i;
  PaktQuiz.addClass(div, "pakt-quiz-question-type-scale");
  for (i = this.scaleMin; i <= this.scaleMax; i++) {
    div.appendChild(
      new PaktQuiz.Scale(i, this, i - 1).render(this.onChange.bind(this))
    );
  }

  return div;
};

PaktQuiz.Question.prototype.renderImage = function() {
  var container = document.createElement("div");
  var image = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-quiz-question-image-container");
  PaktQuiz.addClass(image, "pakt-quiz-question-image");

  if (this.imageFilename) {
    image.style.backgroundImage =
      "url('" + this.quiz.assetBaseUrl + "images/" + this.imageFilename + "')";
  }

  container.appendChild(image);
  return container;
};

PaktQuiz.Question.prototype.renderNextButton = function() {
  var question = this;
  var button = document.createElement("div");
  button.innerHTML = "Next";
  PaktQuiz.addClass(button, "pakt-quiz-button-next");
  button.style.backgroundImage =
    "url(" + this.quiz.assetBaseUrl + "images/next_button.svg)";

  button.onclick = function() {
    PaktQuiz.addClass(this.element, "navigated");
    this.forwardToQuestion(question.index + 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.renderPreviousButton = function() {
  var question = this;
  var button = document.createElement("div");
  button.innerHTML = "Previous";
  PaktQuiz.addClass(button, "pakt-quiz-button-previous");
  button.style.backgroundImage =
    "url(" + this.quiz.assetBaseUrl + "images/back_button.svg)";

  button.onclick = function() {
    PaktQuiz.addClass(this.element, "navigated");
    this.backwardToQuestion(question.index - 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.renderGradeButton = function() {
  var button = document.createElement("div");
  button.innerHTML = "Grade";
  button.className = "pakt-quiz-button-grade";
  button.style.backgroundImage =
    "url(" + this.quiz.assetBaseUrl + "images/next_button.svg)";
  button.onclick = function() {
    this.grade();
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.serialize = function() {
  var inputs = this.element.getElementsByTagName("input");
  var values = [];

  var i;
  for (i = 0; i < inputs.length; i++) {
    if (inputs[i].checked) {
      values.push(parseInt(inputs[i].value, 10));
    }
  }

  return values;
};

PaktQuiz.Question.prototype.demote = function(isReversed) {
  var quizHeight = this.quiz.element.offsetHeight;

  PaktQuiz.removeClass(this.element, "pakt-quiz-promoted");
  PaktQuiz.addClass(this.element, "pakt-quiz-demoting");

  var top = quizHeight + "px";
  if (!isReversed) top = "-" + top;
  this.element.style.top = top;

  setTimeout(
    function() {
      PaktQuiz.removeClass(this.element, "pakt-quiz-demoting");
    }.bind(this),
    PaktQuiz.transitionTime
  );
};

PaktQuiz.Question.prototype.promote = function(isReversed) {
  var quizHeight = this.quiz.element.offsetHeight;

  PaktQuiz.addClass(this.element, "pakt-quiz-promoting");
  PaktQuiz.removeClass(this.element, "pakt-quiz-demoted");

  var top = quizHeight + "px";
  if (isReversed) top = "-" + top;
  this.element.style.top = top;

  this.quiz.scrollTo(this.index);

  setTimeout(
    function() {
      PaktQuiz.removeClass(this.element, "pakt-quiz-promoting");
      PaktQuiz.addClass(this.element, "pakt-quiz-promoted");
      this.element.style.top = "0";
    }.bind(this),
    0
  );
};

PaktQuiz.Choice = function(textAndValue, question, number) {
  this.question = question;
  this.number = number;

  var split = textAndValue.split(":");
  this.text = split[0];
  this.value = parseInt(split[1].trim(), 10);
};

PaktQuiz.hasClass = function(el, className) {
  if (el.classList) {
    return el.classList.contains(className);
  } else {
    return !!el.className.match(new RegExp("(\\s|^)" + className + "(\\s|$)"));
  }
};

PaktQuiz.addClass = function(el, className) {
  if (el.classList) {
    el.classList.add(className);
  } else if (!hasClass(el, className)) {
    el.className += " " + className;
  }
};

PaktQuiz.removeClass = function(el, className) {
  if (el.classList) {
    el.classList.remove(className);
  } else if (hasClass(el, className)) {
    var reg = new RegExp("(\\s|^)" + className + "(\\s|$)");
    el.className = el.className.replace(reg, " ");
  }
};

PaktQuiz.Choice.prototype.id = function() {
  return "pakt_quiz_question_" + this.question.number + "_" + this.number;
};

PaktQuiz.Choice.prototype.name = function() {
  return "question_" + this.question.number;
};

PaktQuiz.Choice.prototype.renderLabel = function() {
  var l = document.createElement("label");
  var t = document.createElement("span");
  l.htmlFor = this.id();
  t.textContent = PaktQuiz.normalizeHTML(this.text.toString());
  l.appendChild(t);
  return l;
};

PaktQuiz.Choice.prototype.renderInput = function(onChange) {
  var i = document.createElement("input");

  if (this.question.text.indexOf("select more than one") !== -1) {
    // allow multiple selections
    i.type = "checkbox";
  } else {
    // allow one selection
    i.type = "radio";
  }

  i.id = this.id();
  i.name = this.name();
  i.value = this.value;
  i.addEventListener("change", onChange);

  return i;
};

PaktQuiz.Choice.prototype.render = function(onChange) {
  this.element = document.createElement("p");
  this.input = this.renderInput(onChange);

  this.element.appendChild(this.input);
  this.element.appendChild(this.renderLabel());
  return this.element;
};

PaktQuiz.Scale = function(value, question, number) {
  this.value = value;
  this.question = question;
  this.number = number;
  this.text = value;
};

PaktQuiz.Scale.prototype.id = PaktQuiz.Choice.prototype.id;
PaktQuiz.Scale.prototype.name = PaktQuiz.Choice.prototype.name;
PaktQuiz.Scale.prototype.renderLabel = PaktQuiz.Choice.prototype.renderLabel;
PaktQuiz.Scale.prototype.renderInput = PaktQuiz.Choice.prototype.renderInput;
PaktQuiz.Scale.prototype.render = PaktQuiz.Choice.prototype.render;
PaktQuiz.Scale.prototype.render = PaktQuiz.Choice.prototype.render;
PaktQuiz.Scale.prototype.serialize = PaktQuiz.Choice.prototype.serialize;

PaktQuiz.Results = function(options) {
  this.levels = [];
  this.quiz = options.quiz;

  var lines = options.quizResultsData.split("\n"),
      levelLines = [],
      i,
      line,
      levels,
      isLast;

  for (i = 0; i < lines.length; i++) {
    line = PaktQuiz.escapeHTML(lines[i]);

    if (
      (PaktQuiz.Results.startsWithLevel(line) && // new level?
       levelLines.length !== 0) || // not first level?
	i == lines.length - 1 // last level?
    ) {
      isLast = i == lines.length - 1;
      if (isLast) levelLines.push(line); // last level

      // we've discovered levels. initialize the levels
      levels = PaktQuiz.Results.levelLinesToLevels(
	this.quiz,
	levelLines.join("\n"),
	isLast
      );
      this.levels = this.levels.concat(levels);

      // start the buffer for the next level
      levelLines = [line];
    } else if (line == "") {
      // empty line
      continue;
    } else {
      // not a new question, so add line to the current level
      levelLines.push(line);
    }
  }
};

PaktQuiz.Results.prototype.findLevel = function(points) {
  var i;
  for (i = 0; i < this.levels.length; i++) {
    if (this.levels[i].doesMatch(points)) return this.levels[i];
  }

  return null;
};

PaktQuiz.Results.startsWithLevelDetector = new RegExp("Level (.*):");
PaktQuiz.Results.startsWithLevel = function(line) {
  var levelsResults = line.match(PaktQuiz.Results.startsWithLevelDetector);
  return !!levelsResults;
};

PaktQuiz.Results.extractor = new RegExp("Level(.*):(.*) +\\(([0-9-, ]*)\\)$");
PaktQuiz.Results.levelLinesToLevels = function(quiz, levelLines, isLast) {
  levelLines = PaktQuiz.escapeHTML(levelLines);

  var lines = levelLines.split("\n");
  var titleAndLevels = lines.shift();
  var extracted = titleAndLevels.match(PaktQuiz.Results.extractor);
  var levels = extracted[1].split("-");
  var title = extracted[2];
  var ranges = extracted[3].split(",");

  var out = [],
      i,
      reallyLast;
  for (i = 0; i < levels.length; i++) {
    reallyLast = i == levels.length - 1 && isLast == true;

    out.push(
      new PaktQuiz.Results.Level(
	quiz,
	levels[i],
	ranges[i],
	title,
	lines.join("\n"),
	reallyLast
      )
    );
  }

  return out;
};

PaktQuiz.Results.Level = function(
  quiz,
  level,
  rangeText,
  title,
  description,
  isLast
) {
  var range = rangeText.split("-");
  this.level = parseInt(level.trim(), 10);
  this.low = parseInt(range[0].trim(), 10);
  this.high = parseInt(range[1].trim(), 10);
  this.title = title.trim();
  this.description = description.trim();
  this.imageUrl =
    quiz.assetBaseUrl + "images/badge_level" + this.level + ".svg";
  this.quiz = quiz;
  this.index = quiz.questions.length;

  if (isLast) {
    this.high = 9999; // highest range has no functional upper bound
  }
};

PaktQuiz.Results.Level.prototype.render = function(resultsSet, estimate) {
  var quizHeight = document.body.clientHeight;
  this.element = document.createElement("div");
  this.element.style.transition =
    "top " + PaktQuiz.transitionTime / 1000 + "s" + "ease 0s";
  this.element.style.top = quizHeight + "px";

  PaktQuiz.addClass(this.element, "pakt-quiz-result");

  this.element.appendChild(this.renderBadgeContainer());
  this.element.appendChild(
    this.renderDescriptionContainer(resultsSet, estimate)
  );

  return this.element;
};

PaktQuiz.Results.Level.prototype.renderBadgeContainer = function() {
  var badgeContainer = document.createElement("div");
  PaktQuiz.addClass(badgeContainer, "pakt-quiz-results-badge-container");

  var intermediateContainer = document.createElement("div");
  badgeContainer.appendChild(intermediateContainer);

  var badgeImage = document.createElement("img");
  badgeImage.src = this.imageUrl;
  PaktQuiz.addClass(badgeImage, "pakt-quiz-results-badge-image");
  intermediateContainer.appendChild(badgeImage);

  return badgeContainer;
};

PaktQuiz.Results.Level.prototype.renderDescriptionContainer = function(
  resultsSet,
  estimate
) {
  var descriptionContainer = document.createElement("div");
  PaktQuiz.addClass(
    descriptionContainer,
    "pakt-quiz-results-description-container"
  );

  var intermediateContainer = document.createElement("div");
  descriptionContainer.appendChild(intermediateContainer);

  intermediateContainer.appendChild(this.renderPreviousButton());

  var estimateTitle = document.createElement("h2");
  PaktQuiz.addClass(estimateTitle, "pakt-quiz-results-estimate-title");

  var estimateTitleCopy = PaktQuiz.escapeHTML(
    document.getElementById("pakt_estimate_so_you_thought").innerHTML
  ).trim();
  estimateTitle.innerHTML = estimateTitleCopy.replace(/X\?$/g, estimate + "?");
  intermediateContainer.appendChild(estimateTitle);

  var rightOrNot = document.createElement("p");
  if (this.level == estimate) {
    rightOrNot.innerHTML = PaktQuiz.escapeHTML(
      document.getElementById("pakt_estimate_equal").innerHTML
    ).trim();
  } else if (this.level < estimate) {
    rightOrNot.innerHTML = PaktQuiz.escapeHTML(
      document.getElementById("pakt_estimate_lower").innerHTML
    ).trim();
  } else {
    rightOrNot.innerHTML = PaktQuiz.escapeHTML(
      document.getElementById("pakt_estimate_higher").innerHTML
    ).trim();
  }

  intermediateContainer.appendChild(rightOrNot);

  var levelContainer = document.createElement("h3");
  PaktQuiz.addClass(levelContainer, "pakt-quiz-results-level-title");
  var levelText = document.createElement("span");
  levelText.innerHTML = "Level " + this.level + ": " + this.title;

  levelContainer.appendChild(levelText);
  intermediateContainer.appendChild(levelContainer);

  var descriptionText = document.createElement("p");
  descriptionText.innerHTML = PaktQuiz.normalizeHTML(this.description);
  PaktQuiz.addClass(descriptionText, "pakt-quiz-results-description");
  intermediateContainer.appendChild(descriptionText);

  var title = document.createElement("h3");
  PaktQuiz.addClass(title, "pakt-quiz-newsletter-callout");
  title.innerHTML = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(
      document.getElementById("pakt_newsletter_title").innerHTML
    )
  );
  intermediateContainer.appendChild(title);

  var downButton = document.createElement("a");
  downButton.href = "#newsletter";
  downButton.style.backgroundImage =
    "url(" + this.quiz.assetBaseUrl + "images/down_button.svg)";
  PaktQuiz.addClass(downButton, "pakt-newsletter-callout-link");
  //intermediateContainer.appendChild(downButton);

  /*var nl = document.createElement("div");
    nl.setAttribute("id", "nlbox");
    intermediateContainer.appendChild(nl);*/


  var copy = document.createElement("p");
  copy.innerHTML = PaktQuiz.normalizeHTML(
    document.getElementById("pakt_newsletter_copy").innerHTML
  );
  intermediateContainer.appendChild(copy);

  // var newsletter = document.createElement("div");
  // PaktQuiz.addClass(div, "pakt-quiz-newsletter");
  // PaktQuiz.addClass(div, "movetop");
  // intermediateContainer.appendChild(newsletter);

  var form = document.createElement("form");
  form.action = "https://manage.kmail-lists.com/subscriptions/subscribe";
  form.method = "POST";
  form.target = "_blank";
  form.novalidate = "novalidate";
  form.setAttribute("id", "nlFormQuiz");
  form.setAttribute("data-ajax-submit", "//manage.kmail-lists.com/ajax/subscriptions/subscribe");
  PaktQuiz.addClass(form, "klaviyo_subscription_form");
  form.appendChild(this.renderEmail());
  //form.appendChild(this.renderQuizResults(lavel));
  form.appendChild(this.renderSubmitButton());
  form.appendChild(this.renderResultsArea());

  //div.appendChild(form);

  var learnMoreButtonContainer = document.createElement("div");
  var learnMoreButton = document.createElement("a");
  learnMoreButton.innerHTML = "Learn More";
  learnMoreButton.href = "http://www.paktcoffee.com";
  PaktQuiz.addClass(learnMoreButton, "pakt-quiz-results-learn-more");
  PaktQuiz.addClass(learnMoreButton, "button");
  learnMoreButtonContainer.appendChild(learnMoreButton);
  intermediateContainer.appendChild(learnMoreButtonContainer);

  return descriptionContainer;
};

PaktQuiz.Results.Level.prototype.renderPreviousButton =	PaktQuiz.Question.prototype.renderPreviousButton;

PaktQuiz.Results.Level.prototype.doesMatch = function(points) {
  if (points < this.low) return false;
  if (points > this.high) return false;
  return true;
};

PaktQuiz.Results.Level.prototype.renderEmail = function() {
  var container = document.createElement("div");
  PaktQuiz.addClass(container, "mc-field-group");

  var input = document.createElement("input");
  input.type = "email";
  input.name = "email"; //"kb398f0c1fb438e4d0bbf3578ce759bdf";
  input.placeholder = "ENTER EMAIL";
  input.id = "id_kb398f0c1fb438e4d0bbf3578ce759bdf";
  input.value = "";
  PaktQuiz.addClass(input, "email");
  container.appendChild(input);


  var input2 = document.createElement("input");
  input2.type = "hidden";
  input2.name = "g"; //"kb398f0c1fb438e4d0bbf3578ce759bdf";
  input2.value = "QyMCFB";
  container.appendChild(input2);

  return container;
};

PaktQuiz.Results.Level.prototype.renderSubmitButton = function() {
  var button = document.createElement("input");
  button.type = "submit";
  button.name = "subscribe";
  button.id = "subscribe_button";
  button.value = "GET UPDATES";
  button.onclick = function(){
    fbq('track', 'Subscribe');
  };
  PaktQuiz.addClass(button, "button");

  return button;
};

PaktQuiz.Results.Level.prototype.renderResultsArea = function() {
  var container = document.createElement("div");
  container.id = "mce-responses";
  PaktQuiz.addClass(container, "klaviyo_messages");

  var success = document.createElement("div");
  success.id = "mce-success-response";
  PaktQuiz.addClass(success, "success_message");
  container.appendChild(success);

  var error = document.createElement("div");
  error.id = "mce-error-response";
  PaktQuiz.addClass(error, "error_message");
  container.appendChild(error);

  var productCallout = document.createElement("p");
  PaktQuiz.addClass(productCallout, "pakt-product-callout");
  productCallout.innerHTML = document.getElementById(
    "pakt_product_callout"
  ).innerHTML;
  container.appendChild(productCallout);

  return container;
};

PaktQuiz.Newsletter = function() {};

PaktQuiz.Newsletter.prototype.render = function(level) {
  var container = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-quiz-newsletter");

  var link = document.createElement("a");
  link.name = "newsletter";
  container.appendChild(link);




  var txt = document.createElement("div");
  txt.appendChild(this.renderBlurb());
  container.appendChild(txt);

  container.appendChild(this.renderSharingTools());


  // var frm = document.getElementById('nlFormQuiz');
  // frm.appendChild(this.renderQuizResults(level));

  setTimeout(
    function() {
      this.initialize();
    }.bind(this),
    1
  );

  return container;
};

PaktQuiz.Newsletter.prototype.initialize = function() {
  if (PaktQuiz.Newsletter.initialized) return;

  (function($) {
    window.fnames = new Array();
    window.ftypes = new Array();
    window.fnames[0] = "EMAIL";
    window.ftypes[0] = "email";
    window.fnames[1] = "QUIZ_RESULTS";
    window.ftypes[1] = "hidden";
  })(window.jQuery);

  PaktQuiz.Newsletter.initialized = true;
};

PaktQuiz.Newsletter.prototype.renderQuizResults = function(level) {
  var container = document.createElement("div");
  //  PaktQuiz.addClass(container, "mc-field-group");

  var input = document.createElement("input");
  input.type = "hidden";
  input.name = "k7ecb717f51c149488bc2abd30561d5e6";
  input.id = "id_k7ecb717f51c149488bc2abd30561d5e6";
  input.value = level.level;

  return input;
};

PaktQuiz.Newsletter.prototype.renderSharingTools = function() {

  var assetBaseUrl = document
      .getElementById("pakt_assets_base_url")
      .textContent.trim();

  var message = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(
      document.getElementById("pakt_results_share_exclaimation").innerHTML
    )
  );
  var resultsSet = [];
  var shareUrl = PaktQuiz.shareUrl(resultsSet);

  var sharingTools = document.createElement("div");
  PaktQuiz.addClass(sharingTools, "pakt-quiz-results-sharing-tools");

  var shareText = document.createElement("h4");
  PaktQuiz.addClass(shareText, "pakt-quiz-results-share-title");
  shareText.innerHTML = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(
      document.getElementById("pakt_results_share_prompt").innerHTML
    )
  );
  sharingTools.appendChild(shareText);

  var socialLinks = document.createElement("div");
  PaktQuiz.addClass(socialLinks, "pakt-quiz-social-links");

  var facebookLink = document.createElement("a");
  facebookLink.href =
    "https://www.facebook.com/sharer/sharer.php?u=" +
    encodeURIComponent(shareUrl);
  facebookLink.target = "_blank";
  facebookLink.innerHTML = "Facebook";
  facebookLink.style.backgroundImage =
    "url(https://cdn.shopify.com/s/files/1/0012/6874/4281/files/facebook.svg?15862)";
  PaktQuiz.addClass(facebookLink, "pakt-quiz-facebook-share");
  socialLinks.appendChild(facebookLink);

  var twitterLink = document.createElement("a");
  twitterLink.href =
    "http://twitter.com/share?text=" +
    encodeURIComponent(message) +
    "&url=" +
    encodeURIComponent(shareUrl);
  twitterLink.target = "_blank";
  twitterLink.innerHTML = "Twitter";
  twitterLink.style.backgroundImage =
    "url(https://cdn.shopify.com/s/files/1/0012/6874/4281/files/twitter.svg?15862)";
  PaktQuiz.addClass(twitterLink, "pakt-quiz-twitter-share");
  socialLinks.appendChild(twitterLink);

  var textLink = document.createElement("a");
  textLink.innerHTML = "Text";
  textLink.href = "sms:?&body=" + encodeURIComponent(message + " " + shareUrl);
  textLink.style.backgroundImage =
    "url(https://cdn.shopify.com/s/files/1/0012/6874/4281/files/text_share_button.svg?15862)";
  PaktQuiz.addClass(textLink, "pakt-quiz-text-share");
  socialLinks.appendChild(textLink);

  var emailLink = document.createElement("a");
  emailLink.innerHTML = "Email";
  emailLink.href =
    "mailto:?&subject=" +
    encodeURIComponent(message) +
    "&body=" +
    encodeURIComponent(shareUrl);
  emailLink.style.backgroundImage =
    "url(https://cdn.shopify.com/s/files/1/0012/6874/4281/files/email.png?15862)";
  PaktQuiz.addClass(emailLink, "pakt-quiz-email-share");
  socialLinks.appendChild(emailLink);

  sharingTools.appendChild(socialLinks);
  return sharingTools;
};

PaktQuiz.Newsletter.prototype.renderBlurb = function() {
  var container = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-newsletter-blurb");

  var logo = document.createElement("img");
  logo.src = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(
      document.getElementById("pakt_newsletter_logo").innerHTML
    )
  );
  container.appendChild(logo);



  return container;
};

PaktQuiz.IntroScreen = function(options) {
  this.quizData = document.getElementById("pakt_quiz").textContent.trim();
  this.quizResultsData = document
    .getElementById("pakt_quiz_results")
    .textContent.trim();
  this.assetBaseUrl = document
    .getElementById("pakt_assets_base_url")
    .textContent.trim();

  this.quiz = new PaktQuiz({
    quizCopy: this.quizData,
    assetBaseUrl: this.assetBaseUrl
  });

  window.paktQuiz = this.quiz;

  this.element = this.render();

  var container = document.getElementsByClassName("main-content")[0];
  container.innerHTML = "";
  container.appendChild(this.element);
};

PaktQuiz.IntroScreen.prototype.start = function() {
  var container = document.getElementsByClassName("main-content")[0];
  container.innerHTML = "";
  container.appendChild(this.quiz.render(container));

  this.quiz.results = new PaktQuiz.Results({
    quiz: this.quiz,
    quizResultsData: this.quizResultsData
  });
};

PaktQuiz.IntroScreen.prototype.render = function() {
  var container = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-quiz-intro");

  var intermediateContainer = document.createElement("div");
  container.appendChild(intermediateContainer);

  var title = document.createElement("h1");
  PaktQuiz.addClass(title, "pakt-quiz-intro-title");
  title.innerHTML = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(document.getElementById("pakt_intro_title").innerHTML)
  );
  intermediateContainer.appendChild(title);

  var blurb = document.createElement("p");
  PaktQuiz.addClass(blurb, "pakt-quiz-intro-blurb");
  blurb.innerHTML = PaktQuiz.normalizeHTML(
    PaktQuiz.escapeHTML(document.getElementById("pakt_intro_blurb").innerHTML)
  );
  intermediateContainer.appendChild(blurb);

  var link = document.createElement("a");
  PaktQuiz.addClass(link, "pakt-quiz-intro-link");
  intermediateContainer.appendChild(link);
  link.onclick = this.start.bind(this);
  link.innerHTML = "click";
  link.style.backgroundImage =
    "url(" + this.quiz.assetBaseUrl + "images/intro_link.svg)";

  return container;
};

document.addEventListener("DOMContentLoaded", function() {
  setTimeout(function() {
    var intro = new PaktQuiz.IntroScreen();

    var pastResults = PaktQuiz.getQueryStrings()["results"];
    if (pastResults) {
      intro.start();

      setTimeout(function() {
	intro.quiz.populateResults(PaktQuiz.decodeResults(pastResults));
      }, 0);
    }
  }, 0);
});
