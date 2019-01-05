var PaktQuiz = function(quizData, quizResultsData){
  this.questions = [];

  var lines = quizData.split("\n"),
      questionLines = [],
      i,
      line;

  for (i=0;i<lines.length;i++){
    line = PaktQuiz.escapeHTML(lines[i]);

    if (
      (PaktQuiz.startsWithNumber(line) && // new question?
       questionLines.length !== 0) || // not first question?
        i == lines.length - 1         // last question?
    ){
      // we've discovered a whole question. initialize the question
      this.questions.push(
        new PaktQuiz.Question(questionLines.join("\n"), this, this.questions.length)
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

  this.results = new PaktQuiz.Results(quizResultsData);
};

PaktQuiz.transitionTime = 500; // milliseconds

PaktQuiz.startsWithNumberMatcher = new RegExp("^[0-9]+\.? ");
PaktQuiz.startsWithNumber = function(line){
  return line.match(PaktQuiz.startsWithNumberMatcher) !== null;
};

PaktQuiz.escapeHTML = function(line) {
  return line.
    trim().
    replace(/“|”/g, '"').
    replace(/’/g, "'").
    replace(/&/g, "&amp;").
    replace(/</g, "&lt;").
    replace(/>/g, "&gt;").
    replace(/"/g, "&quot;").
    replace(/'/g, "&#039;").
    replace(/…/g, "...").
    replace(/&amp;#039;/g, "'");
};

PaktQuiz.prototype.render = function(){
  var quiz = this;
  this.element = document.createElement("ol");
  this.element.id = "pakt_quiz";

  var i;
  for (i=0;i<this.questions.length;i++){
    this.element.appendChild(this.questions[i].render());
  }

  var gradeButton = document.createElement("button");
  gradeButton.innerHTML = "Grade";
  gradeButton.className = "pakt-quiz-grade-button";
  gradeButton.onclick = function(){
    alert("Grade: " + quiz.grade());
  };

  this.element.appendChild(gradeButton);

  setTimeout(function(){
    this.forwardToQuestion(0);
  }.bind(this), 0);

  return this.element;
};

PaktQuiz.prototype.grade = function(){
  var i, points = 0;
  for (i=0;i<this.questions.length;i++){
    points += this.questions[i].serialize();
  }

  var grade = this.results.findLevel(points);
  return grade.title;
};

PaktQuiz.prototype.forwardToQuestion = function(questionIndex){
  this.questions[questionIndex].promote();
};

PaktQuiz.prototype.backwardToQuestion = function(questionIndex){
  this.questions[questionIndex].promote(true);
};

PaktQuiz.base62Digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
PaktQuiz.toBase62 = function(n) {
  if (n === 0) {
    return '0';
  }

  var result = '';
  while (n > 0) {
    result = PaktQuiz.base62Digits[n % PaktQuiz.base62Digits.length] + result;
    n = parseInt(n / PaktQuiz.base62Digits.length, 10);
  }

  return result;
};

PaktQuiz.fromBase62 = function(s) {
  var result = 0;
  for (var i=0 ; i<s.length ; i++) {
    var p = PaktQuiz.base62Digits.indexOf(s[i]);
    if (p < 0) {
      return NaN;
    }
    result += p * Math.pow(PaktQuiz.base62Digits.length, s.length - i - 1);
  }
  return result;
};

PaktQuiz.chunkArray = function(arr, chunkSize) {
  var R = [];
  for (var i=0; i<arr.length; i+=chunkSize)
    R.push(arr.slice(i,i+chunkSize));
  return R;
};

PaktQuiz.encodeResults = function(resultsSet) {
  // reduce each result by 1 so that we can encode 10 in one digit
  var setLessOne = [];
  for (var i=0;i<resultsSet.length;i++){
    setLessOne.push(resultsSet[i] - 1);
  }

  // we are going to encode sets of results as large
  // numbers. javascript doesn't handle large numbers over
  // ~9007199254740991, which is 16 digits long. we pad the number
  // with a 1 so that we can encode a leading zero, so that leaves us
  // with 15 digits. we are going to encode chunks of 15 digits
  // delimited by a '-'
  var chunked = PaktQuiz.chunkArray(setLessOne, 15);

  var out = [];
  for (var i=0;i<chunked.length;i++){
    out.push(
      PaktQuiz.toBase62('1' + chunked[i].join(''))
    );
  }

  return out.join("-");
};

PaktQuiz.decodeResults = function(codedResults) {
  var out = [];

  // our numbers are delimited by '-'
  var split = codedResults.split("-");

  var numbers = [];
  for (var i=0;i<split.length;i++){
    numbers.push(PaktQuiz.fromBase62(split[i]));
  }

  var stringNumbers;
  for (var i=0;i<numbers.length;i++){
    // remove the leading 1
    stringNumbers = numbers[i].toString().slice(1, numbers[i].toString().length).split("");

    // parse each result as an integer and add 1 to translate the
    // 0-9 range to 1-10
    for (var n=0;n<stringNumbers.length;n++){
      out.push(parseInt(stringNumbers[n], 10) + 1);
    }
  }

  return out;
};

PaktQuiz.baseUrl = "https://pakt.io/quiz";
PaktQuiz.shareUrl = function(resultsSet){
  return PaktQuiz.baseUrl + "?results=" + PaktQuiz.encodeResults(resultsSet);
};

PaktQuiz.Question = function(questionAndChoices, quiz, index){
  this.choices   = [];
  this.quiz      = quiz;
  this.index     = index;
  this.selection = null;
  this.scaleMin  = null;
  this.scaleMax  = null;

  var lines             = questionAndChoices.split("\n"),
      numberAndQuestion = lines.shift().trim(),
      extracted         = numberAndQuestion.match(PaktQuiz.Question.extractor);

  this.number = parseInt(extracted[1]) - 1;
  this.text = extracted[2].trim();

  var textAndImage = this.text.match(PaktQuiz.Question.imageFilenameExtractor);
  if (textAndImage){
    this.text = textAndImage[1];
    this.imageFilename = textAndImage[2];
    this.imageName = textAndImage[2].match(PaktQuiz.Question.imageNameExtractor)[1];
  }

  this.detectType();

  var i, line, choice;
  for (i=0;i<lines.length;i++){
    line = lines[i];
    if (line.trim() == "") continue;
    this.choices.push(new PaktQuiz.Choice(line, this, i));
  }
};

PaktQuiz.Question.scaleExtractor = new RegExp("a scale of ([0-9]+)\-([0-9]+)");
PaktQuiz.Question.prototype.detectType = function(){
  var scaleExtracted = this.text.match(PaktQuiz.Question.scaleExtractor);

  if (scaleExtracted !== null){
    this.type     = "scale";
    this.scaleMin = parseInt(scaleExtracted[1], 10);
    this.scaleMax = parseInt(scaleExtracted[2], 10);
  } else {
    this.type = "multiple_choice";
  }
};

PaktQuiz.Question.extractor = new RegExp("^([0-9]*).? (.*)$");
PaktQuiz.Question.imageFilenameExtractor = new RegExp("(.*) Image: ?(.*)$");
PaktQuiz.Question.imageNameExtractor = new RegExp(".*/(.*).{4}$");

PaktQuiz.Question.prototype.render = function(){
  this.element = document.createElement("li");

  var promptContainer = document.createElement("div");
  PaktQuiz.addClass(promptContainer, "pakt-quiz-question-prompt-container");
  PaktQuiz.addClass(promptContainer, "pakt-quiz-image-" + this.imageName);

  var responseContainer = document.createElement("div");
  PaktQuiz.addClass(responseContainer, "pakt-quiz-question-response-container");

  promptContainer.appendChild(this.renderPrompt());
  promptContainer.appendChild(this.renderImage());

  var choicesContainer = document.createElement("div");
  PaktQuiz.addClass(choicesContainer, "pakt-quiz-question-choices");

  PaktQuiz.addClass(this.element, "pakt-quiz-question");

  switch(this.type) {
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
    responseContainer.appendChild(this.renderPreviousButton());
  }

  responseContainer.appendChild(choicesContainer);

  if (this.index !== this.quiz.questions.length - 1){
    responseContainer.appendChild(this.renderNextButton());
  }

  this.element.appendChild(promptContainer);
  this.element.appendChild(responseContainer);

  return this.element;
};

PaktQuiz.Question.prototype.renderPrompt = function(){
  var strong = document.createElement("strong");

  PaktQuiz.addClass(strong, "pakt-quiz-question-prompt");
  strong.innerHTML = this.text;

  return strong;
}

PaktQuiz.Question.prototype.renderAsMultipleChoice = function(){
  var div = document.createElement("div"), i;
  PaktQuiz.addClass(div, "pakt-quiz-question-type-multiple-choice");
  for (i=0;i<this.choices.length;i++){
    div.appendChild(this.choices[i].render());
  }

  return div;
};

PaktQuiz.Question.prototype.renderAsScale = function(){
  var div = document.createElement("div"), i;
  PaktQuiz.addClass(div, "pakt-quiz-question-type-scale");
  for (i=this.scaleMin;i<=this.scaleMax;i++){
    div.appendChild(new PaktQuiz.Scale(i, this, i-1).render());
  }

  return div;
};

PaktQuiz.Question.prototype.renderImage = function(){
  var container = document.createElement("div");
  var image = document.createElement("div");
  PaktQuiz.addClass(container, "pakt-quiz-question-image-container");
  PaktQuiz.addClass(image, "pakt-quiz-question-image");

  if (this.imageFilename){
    image.style.backgroundImage = "url('" + this.imageFilename + "')";
  }

  container.appendChild(image);
  return container;
};

PaktQuiz.Question.prototype.renderNextButton = function(){
  var question = this;
  var button = document.createElement("div");
  button.innerHTML = "Next";
  PaktQuiz.addClass(button, "pakt-quiz-button-next");

  button.onclick = function(){
    PaktQuiz.addClass(this.element, "navigated");
    this.forwardToQuestion(question.index + 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.renderPreviousButton = function(){
  var question = this;
  var button = document.createElement("div");
  button.innerHTML = "Previous";
  PaktQuiz.addClass(button, "pakt-quiz-button-previous");

  button.onclick = function(){
    PaktQuiz.addClass(this.element, "navigated");
    this.backwardToQuestion(question.index - 1);
  }.bind(this.quiz);

  return button;
};

PaktQuiz.Question.prototype.serialize = function(){
  var inputs = this.element.getElementsByTagName("input");

  var i;
  for (i=0;i<inputs.length;i++){
    if (inputs[i].checked) return parseInt(inputs[i].value, 10);
  }

  return 0;
};

PaktQuiz.Question.prototype.promote = function(isReversed){
  this.element.scrollIntoView({behavior: "smooth"});
};

PaktQuiz.Choice = function(textAndValue, question, number){
  this.question = question;
  this.number   = number;

  var split = textAndValue.split(":");
  this.text = split[0];
  this.value = parseInt(split[1].trim(), 10);
};

PaktQuiz.hasClass = function(el, className) {
  if (el.classList){
    return el.classList.contains(className);
  } else {
    return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
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
    var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
    el.className=el.className.replace(reg, ' ');
  }
};

PaktQuiz.Choice.prototype.id = function(){
  return "pakt_quiz_question_" + this.question.number + "_" + this.number;
};

PaktQuiz.Choice.prototype.name = function(){
  return "question_" + this.question.number;
};

PaktQuiz.Choice.prototype.renderLabel = function(){
  var l = document.createElement("label");
  var t = document.createElement("span");
  l.htmlFor = this.id();
  t.innerHTML = this.text;
  l.appendChild(t);
  return l;
};

PaktQuiz.Choice.prototype.renderInput = function(){
  var i = document.createElement("input");
  i.type = "radio";
  i.id = this.id();
  i.name = this.name();
  i.value = this.value;

  return i;
};

PaktQuiz.Choice.prototype.render = function(){
  this.element = document.createElement("p");
  this.input   = this.renderInput();

  this.element.appendChild(this.input);
  this.element.appendChild(this.renderLabel());
  return this.element;
};

PaktQuiz.Scale = function(value, question, number){
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
PaktQuiz.Scale.prototype.serialize = PaktQuiz.Choice.prototype.serialize;

PaktQuiz.Results = function(resultsData){
  this.levels = [];

  var lines = resultsData.split("\n"),
      levelLines = [],
      i,
      line,
      levels;

  for (i=0;i<lines.length;i++){
    line = PaktQuiz.escapeHTML(lines[i]);

    if (
      (PaktQuiz.Results.startsWithLevel(line) && // new level?
       levelLines.length !== 0) ||               // not first level?
        i == lines.length - 1                    // last level?
    ){
      // we've discovered levels. initialize the levels
      levels = PaktQuiz.Results.levelLinesToLevels(levelLines.join("\n"));
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

PaktQuiz.Results.prototype.findLevel = function(points){
  var i;
  for (i=0;i<this.levels.length;i++){
    if (this.levels[i].doesMatch(points)) return this.levels[i];
  }

  return null;
};

PaktQuiz.Results.startsWithLevelDetector = new RegExp("Level (.*):");
PaktQuiz.Results.startsWithLevel = function(line){
  var levelsResults = line.match(PaktQuiz.Results.startsWithLevelDetector);
  return !!levelsResults;
};

PaktQuiz.Results.extractor = new RegExp("Level(.*):(.*) +\\(([0-9\-\, ]*)\\)");
PaktQuiz.Results.levelLinesToLevels = function(levelLines){
  levelLines = PaktQuiz.escapeHTML(levelLines);

  var lines          = levelLines.split("\n");
  var titleAndLevels = lines.shift();
  var extracted      = titleAndLevels.match(PaktQuiz.Results.extractor);
  var levels         = extracted[1].split("-");
  var title          = extracted[2];
  var ranges         = extracted[3].split(",");

  var out = [], i;
  for (i=0;i<levels.length;i++){
    out.push(
      new PaktQuiz.Results.Level(levels[i], ranges[i], title, lines.join("\n"))
    );
  }

  return out;
};

PaktQuiz.Results.Level = function(level, rangeText, title, description){
  var range        = rangeText.split("-");
  this.level       = parseInt(level.trim(), 10);
  this.low         = parseInt(range[0].trim(), 10);
  this.high        = parseInt(range[1].trim(), 10);
  this.title       = title.trim();
  this.description = description.trim();
};

PaktQuiz.Results.Level.prototype.doesMatch = function(points){
  if (points < this.low)  return false;
  if (points > this.high) return false;
  return true;
};

window.onload = function(){
  var quizData = document.getElementById("pakt_quiz").innerHTML.trim();
  var quizResultsData = document.getElementById("pakt_quiz_results").innerHTML.trim();

  var quiz = new PaktQuiz(quizData, quizResultsData);
  window.paktQuiz = quiz;
  document.body.appendChild(quiz.render());
};
