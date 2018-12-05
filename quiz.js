var PaktQuiz = function(quizData){
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
        new PaktQuiz.Question(questionLines.join("\n"))
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
    replace(/'/g, "&#039;");
};

PaktQuiz.prototype.render = function(){
  var i, buffer = [];
  for (i=0;i<this.questions.length;i++){
    buffer.push(
      this.questions[i].render()
    );
  }

  return buffer.join("\n");
};

PaktQuiz.Question = function(questionAndChoices){
  this.choices = [];
  this.selection = null;
  this.scaleMin = null;
  this.scaleMax = null;

  var lines             = questionAndChoices.split("\n"),
      numberAndQuestion = lines.shift().trim(),
      extracted         = numberAndQuestion.match(PaktQuiz.Question.extractor);

  this.number = parseInt(extracted[1]) - 1;
  this.text = extracted[2].trim();

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

PaktQuiz.Question.prototype.render = function(){
  var buffer = [this.renderPrompt()];

  switch(this.type) {
  case "multiple_choice":
    buffer.push(this.renderAsMultipleChoice());
    break;
  case "scale":
    buffer.push(this.renderAsScale());
    break;
  }

  return buffer.join("\n");
};

PaktQuiz.Question.prototype.renderPrompt = function(){
  return "<li><strong>" + this.text + "</strong></li>";
}

PaktQuiz.Question.prototype.renderAsMultipleChoice = function(){
  var i, buffer = [];

  for (i=0;i<this.choices.length;i++){
    buffer.push(this.choices[i].render());
  }

  return buffer.join("\n");
};

PaktQuiz.Question.prototype.renderAsScale = function(){
  var i, buffer = [];

  for (i=this.scaleMin;i<=this.scaleMax;i++){
    buffer.push(new PaktQuiz.Scale(i, this, i-1).render());
  }

  return buffer.join("\n");
};

PaktQuiz.Choice = function(textAndValue, question, number){
  this.question = question;
  this.number   = number;

  var split = textAndValue.split(":");
  this.text = split[0];
  this.value = parseInt(split[1].trim(), 10);
};

PaktQuiz.Choice.prototype.id = function(){
  return "pakt_quiz_question_" + this.question.number + "_" + this.number;
};

PaktQuiz.Choice.prototype.name = function(){
  return "question_" + this.question.number;
};

PaktQuiz.Choice.prototype.label = function(){
  return '<label for="' + this.id() + '">' + this.text + '</label>';
};

PaktQuiz.Choice.prototype.input = function(){
  return '<input type="radio" id="' + this.id() + '" name="' + this.name() + '" value="' + this.value + '" />';
};

PaktQuiz.Choice.prototype.render = function(){
  return "<p>" + this.label() + this.input() + "</p>";
};

PaktQuiz.Scale = function(value, question, number){
  this.value = value;
  this.question = question;
  this.number = number;
  this.text = value;
};

PaktQuiz.Scale.prototype.id = PaktQuiz.Choice.prototype.id;
PaktQuiz.Scale.prototype.name = PaktQuiz.Choice.prototype.name;
PaktQuiz.Scale.prototype.label = PaktQuiz.Choice.prototype.label;
PaktQuiz.Scale.prototype.input = PaktQuiz.Choice.prototype.input;
PaktQuiz.Scale.prototype.render = PaktQuiz.Choice.prototype.render;

window.onload = function(){
  var quizData = document.getElementById("pakt_quiz").innerHTML.trim();

  var quiz = new PaktQuiz(quizData);
  var elem = document.createElement("ol");

  elem.innerHTML = quiz.render();
  document.body.appendChild(elem);
};
