var PaktQuiz = function(quizData){
  this.questions = [];

  var lines = quizData.split("\n"),
      questionLines = [],
      i,
      line;

  for (i=0;i<lines.length;i++){
    line = lines[i].trim();

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

PaktQuiz.Question = function(questionAndChoices){
  this.choices = [];
  this.selection = null;

  var lines             = questionAndChoices.split("\n"),
      numberAndQuestion = lines.shift().trim(),
      extracted         = numberAndQuestion.match(PaktQuiz.Question.extractor);

  this.number = parseInt(extracted[1]);
  this.question = extracted[2].trim();

  var i, line, choice;
  for (i=0;i<lines.length;i++){
    line = lines[i];
    if (line.trim() == "") continue;
    this.choices.push(new PaktQuiz.Choice(line));
  }
};

PaktQuiz.Question.extractor = new RegExp("^([0-9]*).? (.*)$");

PaktQuiz.Choice = function(textAndValue){
  var split = textAndValue.split(":");
  this.text = split[0];
  this.value = parseInt(split[1].trim(), 10);
};

window.onload = function(){
  var quizData = document.getElementById("pakt_quiz").innerHTML.trim();
  console.log(new PaktQuiz(quizData));
};
