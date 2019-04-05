#  `greenframe` - the evergreen framework 🌳🏗

Introducing `greenframe`, a tiny framework for building evergreen web apps. The framework powering dev.memehub.com, the `greenframe` website, and the 2020 redesign of gwynn.design. 

Written in the latest version of Typescript for the latest browsers and inspired by the proprietary framework written for the initial version of memehub.com, `greenframe` allows developers to quickly build custom *components* and *activities*, using ShadowDOM, CustomElements and other high-performance features under-the-hood.

## Evergreen app?

You may have heard of  an evergreen browser - browsers that automatically stay automatically updated with the latest features - an "evergreen app" is a Javascript web app that is built for evergreen browsers.

Not supporting older browsers has many real-world benefits:
* No polyfills. No additional code to be downloaded or executed.
* No dependancies.
* Fast. The browser is doing most of the work.
* No testing on outdated, slow platforms. Bye Internet Explorer 👋

### Falling back

An evergreen app will not work on older browsers, but in many situations such as hosting an online store you may require a fallback platform which will host a stripped back version of the platform which does not require Javascript. Where this is essential, this should be built separately to your Evergreen app.

> Do not use `greenframe` in a mission-critical environment where a UA is likely to have disabled Javascript, or be significantly out-of-date.

### Browser compatibility

`greenframe` aims to be compatible with the current generation of browsers at the time of a release. `greenframe` versioning follows Semver, but **the major version is the year in YY. This specifies that the framework will be compatible with all major browsers released that year according to caniuse.com**

The first version of the framework, `19.0.0` is designed for browsers released in 2019, including the next, (currently) unreleased Chromium-based version of Microsoft Edge.

If you require compatibility before 2019, consider a different framework.

## Get started

Install and save greenframe to your application:

`npm i --save greenframe`

Further documentation will be released soon, for now, here is a quick heavily commented sample application:

```
import {Activity, Application, Component} from "greenframe"

/** Declare our app with it's name. */
const app = new Application("Hello greenframe")

/** Declare a sample component, this inherits from HTMLElement and is declared in the CustomElements registry. */
class SpinningBox extends Component {
	/** No DOM operations should happen in the constructor, just like HTMLElement. These are deferred to the `.setup()` method. */
	constructor() {
		/** To minimise DOM operations later on in `.setup()` we can define initial CSS and HTML. All CSS is isolated with ShadowDOM by default. */
		/** Unlike other libraries, greenframe does not use JSX to do this, rather it opts for using template strings. */
		super(
			`
				<div id="inner"></div>
			`,
			`
				/* :host can be used here to select the SpinningBox itself, just like HTMLElement, making porting existing CustomElement's very quick. */
				:host {
					font-size: 1em;
					height: 5em; width: 5em;
					border: solid thin black;
					display: flex; justify-items: center; align-content: center;
				}

				/* CSS is isolated by default from the rest of the application, so #inner here will only select #inner in this component. */
				#inner {
					background-color: red;
					width: 2.5em;
					height: 2.5em;
					animation: spin infinite 1s;
				}

				@keyframes spin {
					to {transform:rotate(360deg)}
				}
			`
		)
	}

	/** `.setup() exists on every component and is called whenever an element is created. Put your DOM operations here. */
	setup() {
		/** The Component class provides many advantages over HTMLElement, including the ability to quickly and type-safely query for elements. */
		this.$("#inner").addEventListener("click", function() {
			this.style.backgroundColor = "blue"
		})
	}
}

/* An Activity is a state of an application, and will display depending on the current route of the UA. */
class MainActivity extends Activity {
	/** All activities must have titles defined on them. */
	activityTitle = "Main Activity"

	/** Activity extends from Component, so we can use  */
	constructor() {
		super(
			`
				<h1>Greenframe</h1>
			`,
			`
				h1 {
					color: green;
				}
			`
		)
	}

	/** Because `Activity` extends from `Component`, `setup()` here is ran once when the activity is created. */
	/** Be aware that greeenframe may load an activity when the user hasn't yet navigated to it, therefore you should not include anything here that would require user action. e.g. starting video playback */
	setup() {
		// Add our spinning box
		const box = new SpinningBox()

		// Connects the box to this Activity
		box.connectTo(this)
	}

	/** `switchedTo` gets called whenever the Activity is switched to by the user, including if the user lands on this activity. */
	/** It's `args` argument is extracted from the current URL search parameters. e.g. ?a=hello&b=world === {a: "hello", b: "world"} */
	switchedTo(args: {[key: string]: string}) {}
}

/** Once we've defined everything, we need to start the application. This function can be postponed until all of your resources for your application are loaded. */
app.start({
	/** The activity definitions are simply a map of routes to the class. */
	activityDefinitions: {
		/** This states that any user who lands on `/` should be served an instance of the MainActivity class. */
		"/": MainActivity,
	},

	/** We must also define all of the classes we've extended from `Component` other than our Activities, it is important to declare all of your component definitions here. */
	componentDefinitions: [SpinningBox],
})


```