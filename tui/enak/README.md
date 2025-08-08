# Scenarios
A scripting metalanguage to quickly create scenarios for the ENAK game.

The required part of the script is the function `getScript()`, that returns an instance of a `Script` class, provided by the `Enak` module.

Currently, round types are `Day`, `Night`, `Slide`, and `SlideRange`.
Weather conditions take a `Day` or `Night` as an argument, and can be `Sunny`, `Windy`, `Rainy`, or `Snowy`, with the outermost condition overriding the set production coefficients of the inner ones.

```python
from Enak import *

def getScript():
	script = Script()

	script.setPDF("prednaska.pdf")

	#the presentation beginning
	sr = SlideRange(1, 5) #starting index is 1
	script.addRound(sr)

	d = Sunny(Windy(Day()))
	script.addRound(d)

	n = Windy(Night())
	script.addRound(n)

	sl = Slide(1)
	script.addRound(sl)

	#comments for the round types are supported
	d = Sunny(Windy(Day("A windy sunny day")))
	d.outage(Source.GAS)  #outage can be set for the round
	print(d)  #printing the round will show the current state of the round
	script.addRound(d)

	return script
```

You can look at the `Enak` module for the exact value definitions.