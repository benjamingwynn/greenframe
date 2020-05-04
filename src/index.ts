/** @format */
import Activity, {ErrorActivity} from "./Activity"
import Application from "./Application"
import AssetLoader2 from "./AssetLoader2"
import Component, {ComponentConnectionTimeoutError} from "./Component"
import * as DOMUtil from "./DOMUtil"
import {DIV, H, P} from "./E"
import FrameComponent from "./FrameComponent"
import Layout from "./Layout"
import ModalComponent from "./ModalComponent"
import ReactiveComponent, {ReactionMode} from "./ReactiveComponent"
import * as util from "./util"
import {sleep} from "./util"

window.addEventListener("unhandledrejection", (ex) => {
	if (ex.reason && ex.reason.message === "Illegal constructor") {
		console.warn("🌳🏗 It looks like you might be trying to construct a component using `new ()` without registering it first, make sure your `app.start()` includes all the definitions you're trying to use in your app.")
		// console.log(ex)
	}
})

window.addEventListener("error", (ex) => {
	console.log(ex)
	if (ex.message === "Uncaught TypeError: Illegal constructor") {
		console.warn("🌳🏗 It looks like you might be trying to construct a component using `new ()` without registering it first, make sure your `app.start()` includes all the definitions you're trying to use in your app.")
		// console.log(ex)
	}
})
export {DIV, H, P, Component, Activity, Application, ModalComponent, ReactiveComponent, FrameComponent, DOMUtil, util, ReactionMode, ErrorActivity, AssetLoader2, Layout, ComponentConnectionTimeoutError, sleep}
