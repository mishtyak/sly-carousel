/*!
 * sly-light 0.1 - 10th Aug 2020
 *
 * Licensed under the MIT license.
 * http://opensource.org/licenses/MIT
 */

;(function (w) {
	'use strict';

	let pluginName = 'sly',
		className = 'Sly',
		namespace = pluginName;

	// Local WindowAnimationTiming interface
	let cAF = w.cancelAnimationFrame,
		rAF = w.requestAnimationFrame;

	// Support indicators
	let transform = 'transform',
		gpuAcceleration = 'translateZ(0) ',
		passiveSupported = false;

	try {
		let options = Object.defineProperty({}, passive, {
			get: function () {
				passiveSupported = true;
			}
		});

		window.addEventListener('test', null, options);
	} catch (err) {
	}

	// Other global values
	var interactiveElements = ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'];
	var tmpArray = [];
	var time;

	// Math shorthands
	var abs = Math.abs;
	var sqrt = Math.sqrt;
	var pow = Math.pow;
	var round = Math.round;
	var max = Math.max;
	var min = Math.min;

	// Keep track of last fired global wheel event
	let globalwheelEvent = false,
		lastGlobalWheel = 0;

	/**
	 * Sly.
	 *
	 * @class
	 *
	 * @param {Element} frame       DOM element of sly container.
	 * @param {Object}  options     Object with options.
	 * @param {Object}  callbackMap Callbacks map.
	 */
	function Sly(frame, options, callbackMap) {
		// Extend options
		options = options || {};

		let o = {};

		for (let key in Sly.defaults) {
			o[key] = Sly.defaults[key];
			if (key in options)
				o[key] = options[key];
		}

		let viewport_width = document.documentElement.clientWidth;

		o.responsive.some(function (item) {
			if (viewport_width < item.breakpoint) {
				for (let key in item.settings) {
					o[key] = item.settings[key];
				}
				return true;
			}
		});

		// Private variables
		let self = this,
			parallax = isNumber(frame);

		// Frame
		let el_frame = typeof frame === 'object' ? frame : document.querySelector(frame),
			el_slides_box = o.slidee ? document.querySelector(o.slidee) : el_frame.children[0],
			frameSize = 0,
			slideeSize = 0,
			pos = {
				start: 0,
				center: 0,
				end: 0,
				cur: 0,
				dest: 0
			};

		// Scrollbar
		var el_sb = typeof o.scrollBar === 'object' ? o.scrollBar : document.querySelector(o.scrollBar);
		var el_handle = el_sb ? el_sb.children[0] : null;
		var sbSize = 0;
		var handleSize = 0;
		var hPos = {
			start: 0,
			end: 0,
			cur: 0
		};

		// Pagesbar
		let el_pb = typeof o.pagesBar === 'object' ? o.pagesBar : document.querySelector(o.pagesBar),
			el_pages = 0,
			pages = [];

		// Items
		let el_items = 0;
		var items = [];
		var rel = {
			firstItem: 0,
			lastItem: 0,
			centerItem: 0,
			activeItem: null,
			activePage: 0
		};

		// Styles
		var frameStyles = new StyleRestorer(el_frame);
		var slideeStyles = new StyleRestorer(el_slides_box);
		var sbStyles = new StyleRestorer(el_sb);
		var handleStyles = new StyleRestorer(el_handle);

		// Navigation type booleans
		var basicNav = o.itemNav === 'basic';
		var forceCenteredNav = o.itemNav === 'forceCentered';
		var centeredNav = o.itemNav === 'centered' || forceCenteredNav;
		var itemNav = !parallax && (basicNav || centeredNav || forceCenteredNav);

		// Miscellaneous
		var el_scrollSource = o.scrollSource ? document.querySelector(o.scrollSource) : el_frame;
		var el_dragSource = o.dragSource ? document.querySelector(o.dragSource) : el_frame;
		var el_forwardButton = typeof o.forward === 'object' ? o.forward : document.querySelector(o.forward);
		var el_backwardButton = typeof o.backward === 'object' ? o.backward : document.querySelector(o.backward);
		var el_prevButton = typeof o.prev === 'object' ? o.prev : document.querySelector(o.prev);
		var el_nextButton = typeof o.next === 'object' ? o.next : document.querySelector(o.next);
		var el_prevPageButton = typeof o.prevPage === 'object' ? o.prevPage : document.querySelector(o.prevPage);
		var el_nextPageButton = typeof o.nextPage === 'object' ? o.nextPage : document.querySelector(o.nextPage);
		var callbacks = {};
		var last = {};
		var animation = {};
		var move = {};
		var dragging = {
			released: 1
		};
		var scrolling = {
			last: 0,
			delta: 0,
			resetTime: 200
		};
		var renderID = 0;
		var historyID = 0;
		var cycleID = 0;
		var continuousID = 0;
		var i, l;

		// Normalizing frame
		if (!parallax) {
			frame = el_frame;
		}

		// Expose properties
		self.initialized = 0;
		self.frame = frame;
		self.slidee = el_slides_box;
		self.pos = pos;
		self.rel = rel;
		self.items = items;
		self.pages = pages;
		self.isPaused = 0;
		self.options = o;
		self.dragging = dragging;

		/**
		 * Loading function.
		 *
		 * Populate arrays, set sizes, bind events, ...
		 *
		 * @param {Boolean} [isInit] Whether load is called from within self.init().
		 * @return {Void}
		 */
		function load(isInit) {
			// Local variables
			let lastItemsCount = 0,
				lastPagesCount = pages.length;

			// Save old position
			pos.old = {};

			for (let key in pos) {
				if (key !== 'old')
					pos.old[key] = pos[key];
			}

			// Reset global variables
			frameSize = parallax ? 0 : el_slides_box.offsetWidth;
			sbSize = el_sb ? el_sb.clientWidth : 0;

			slideeSize = parallax ? frame : frameSize;
			pages.length = 0;

			// Set position limits & relatives
			pos.start = 0;
			pos.end = max(slideeSize - frameSize, 0);

			// Sizes & offsets for item based navigations
			if (itemNav) {
				// Save the number of current items
				lastItemsCount = items.length;

				// Reset itemNav related variables
				if (o.itemSelector)
					el_items = el_slides_box.querySelectorAll(o.itemSelector);
				else
					el_items = el_slides_box.children;

				items.length = 0;

				// Needed variables
				let elSlidesBoxComputedStyle = window.getComputedStyle(el_slides_box);
				var paddingStart = getPx(el_slides_box, 'padding-left', elSlidesBoxComputedStyle);
				var paddingEnd = getPx(el_slides_box, 'padding-right', elSlidesBoxComputedStyle);
				var borderBox = el_items[0].style.boxSizing === 'border-box';
				var areFloated = el_items[0].style.float !== 'none';
				var ignoredMargin = 0;
				var lastItemIndex = el_items.length - 1;
				var lastItem;

				// Reset slideeSize
				slideeSize = 0;

				let elComputedStyle = window.getComputedStyle(el_items[0]),
					itemMarginStart = getPx(el_items[0], 'margin-left', elComputedStyle),
					itemMarginEnd = getPx(el_items[0], 'margin-right', elComputedStyle);

				// Iterate through items
				[].forEach.call(el_items, function (element, i) {
					if (o.visibleItems)
						element.style.width = frameSize / o.visibleItems - (((itemMarginStart * o.visibleItems) + (itemMarginEnd * (o.visibleItems - 1))) / o.visibleItems) + 'px';

					// Item
					var rect = element.getBoundingClientRect();
					var itemSize = round(rect.width || rect.right - rect.left);
					var itemSizeFull = itemSize + itemMarginStart + itemMarginEnd;
					var singleSpaced = !itemMarginStart || !itemMarginEnd;
					let item = {};

					item.el = element;
					item.size = singleSpaced ? itemSize : itemSizeFull;
					item.half = item.size / 2;
					item.start = slideeSize + (singleSpaced ? itemMarginStart : 0);
					item.center = item.start - round(frameSize / 2 - item.size / 2);
					item.end = item.start - frameSize + item.size;

					// Account for slidee padding
					if (!i)
						slideeSize += paddingStart;

					// Increment slidee size for size of the active element
					slideeSize += itemSizeFull;

					// Things to be done on last item
					if (i === lastItemIndex) {
						item.end += paddingEnd;
						slideeSize += paddingEnd;
						ignoredMargin = singleSpaced ? itemMarginEnd : 0;
					}

					// Add item object to items array
					items.push(item);
					lastItem = item;
				});

				// Resize SLIDEE to fit all items
				el_slides_box.style.width = (borderBox ? slideeSize : slideeSize - paddingStart - paddingEnd) + 'px';

				// Adjust internal SLIDEE size for last margin
				slideeSize -= ignoredMargin;

				// Set limits
				if (items.length) {
					pos.start = items[0][forceCenteredNav ? 'center' : 'start'];
					pos.end = forceCenteredNav ? lastItem.center : frameSize < slideeSize ? lastItem.end : pos.start;
				} else {
					pos.start = pos.end = 0;
				}
			}

			// Calculate SLIDEE center position
			pos.center = round(pos.end / 2 + pos.start / 2);

			// Update relative positions
			updateRelatives();

			// Scrollbar
			if (el_handle && sbSize > 0) {
				// Stretch scrollbar handle to represent the visible area
				if (o.dynamicHandle) {
					handleSize = pos.start === pos.end ? sbSize : round(sbSize * frameSize / slideeSize);
					handleSize = within(handleSize, o.minHandleSize, sbSize);
					el_handle.style.width = handleSize + 'px';
				} else
					handleSize = el_handle.offsetWidth;

				hPos.end = sbSize - handleSize;

				if (!renderID) {
					syncScrollbar();
				}
			}

			// Pages
			if (!parallax && frameSize > 0) {
				let tempPagePos = pos.start,
					pagesHtml = '';

				// Populate pages array
				if (itemNav) {
					items.forEach(function (item) {
						if (forceCenteredNav) {
							pages.push(item.center);
						} else if (item.start + item.size > tempPagePos && tempPagePos <= pos.end) {
							tempPagePos = item.start;
							pages.push(tempPagePos);
							tempPagePos += frameSize;
							if (tempPagePos > pos.end && tempPagePos < pos.end + frameSize) {
								pages.push(pos.end);
							}
						}
					});
				} else {
					while (tempPagePos - frameSize < pos.end) {
						pages.push(tempPagePos);
						tempPagePos += frameSize;
					}
				}

				// Pages bar
				if (el_pb && lastPagesCount !== pages.length) {
					for (let i = 0; i < pages.length; i++) {
						pagesHtml += o.pageBuilder.call(self, i);
					}

					el_pb.innerHTML = pagesHtml;
					el_pages = el_pb.children;
					el_pages[rel.activePage].classList.add(o.activeClass);
				}
			}

			// Extend relative variables object with some useful info
			rel.slideeSize = slideeSize;
			rel.frameSize = frameSize;
			rel.sbSize = sbSize;
			rel.handleSize = handleSize;

			// Activate requested position
			if (itemNav) {
				if (isInit && o.startAt != null) {
					activate(o.startAt);
					self[centeredNav ? 'toCenter' : 'toStart'](o.startAt);
				}
				// Fix possible overflowing
				let activeItem = items[rel.activeItem];
				slideTo(centeredNav && activeItem ? activeItem.center : within(pos.dest, pos.start, pos.end));
			} else {
				if (isInit) {
					if (o.startAt != null) slideTo(o.startAt, 1);
				} else {
					// Fix possible overflowing
					slideTo(within(pos.dest, pos.start, pos.end));
				}
			}

			// Trigger load event
			trigger('load');
		}

		self.reload = function () {
			load();
		};

		/**
		 * Animate to a position.
		 *
		 * @param {Int}  newPos    New position.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 * @param {Bool} dontAlign Do not align items, use the raw position passed in first argument.
		 *
		 * @return {Void}
		 */
		function slideTo(newPos, immediate, dontAlign) {
			// Align items
			if (itemNav && dragging.released && !dontAlign) {
				var tempRel = getRelatives(newPos);
				var isNotBordering = newPos > pos.start && newPos < pos.end;

				if (centeredNav) {
					if (isNotBordering) {
						newPos = items[tempRel.centerItem].center;
					}
					if (forceCenteredNav && o.activateMiddle) {
						activate(tempRel.centerItem);
					}
				} else if (isNotBordering) {
					newPos = items[tempRel.firstItem].start;
				}
			}

			// Handle overflowing position limits
			if (dragging.init && dragging.slidee && o.elasticBounds) {
				if (newPos > pos.end) {
					newPos = pos.end + (newPos - pos.end) / 6;
				} else if (newPos < pos.start) {
					newPos = pos.start + (newPos - pos.start) / 6;
				}
			} else {
				newPos = within(newPos, pos.start, pos.end);
			}

			// Update the animation object
			animation.start = +new Date();
			animation.time = 0;
			animation.from = pos.cur;
			animation.to = newPos;
			animation.delta = newPos - pos.cur;
			animation.tweesing = dragging.tweese || dragging.init && !dragging.slidee;
			animation.immediate = !animation.tweesing && (immediate || dragging.init && dragging.slidee || !o.speed);

			// Reset dragging tweesing request
			dragging.tweese = 0;

			// Start animation rendering
			if (newPos !== pos.dest) {
				pos.dest = newPos;
				trigger('change');
				if (!renderID) {
					render();
				}
			}

			// Reset next cycle timeout
			resetCycle();

			// Synchronize states
			updateRelatives();
			updateButtonsState();
			syncPagesbar();
		}

		/**
		 * Render animation frame.
		 *
		 * @return {Void}
		 */
		function render() {
			if (!self.initialized) return;

			// If first render call, wait for next animationFrame
			if (!renderID) {
				renderID = rAF(render);
				if (dragging.released)
					trigger('moveStart');
				return;
			}

			// If immediate repositioning is requested, don't animate.
			if (animation.immediate) {
				pos.cur = animation.to;
				// Use tweesing for animations without known end point
			} else if (animation.tweesing) {
				animation.tweeseDelta = animation.to - pos.cur;
				// Fuck Zeno's paradox
				if (abs(animation.tweeseDelta) < 0.1)
					pos.cur = animation.to;
				else
					pos.cur += animation.tweeseDelta * (dragging.released ? o.swingSpeed : o.syncSpeed);
			}
			// Use tweening for basic animations with known end point
			else {
				function easeInOutCubic(x) {
					return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;
				}

				animation.time = min(+new Date() - animation.start, o.speed);
				pos.cur = animation.from + animation.delta * easeInOutCubic(animation.time / o.speed);
			}

			// If there is nothing more to render break the rendering loop, otherwise request new animation frame.
			if (animation.to === pos.cur) {
				pos.cur = animation.to;
				dragging.tweese = renderID = 0;
			} else {
				renderID = rAF(render);
			}

			trigger('move');

			// Update SLIDEE position
			if (!parallax)
				el_slides_box.style[transform] = gpuAcceleration + 'translateX' + '(' + (-pos.cur) + 'px)';

			// When animation reached the end, and dragging is not active, trigger moveEnd
			if (!renderID && dragging.released) {
				trigger('moveEnd');
			}

			syncScrollbar();
		}

		/**
		 * Synchronizes scrollbar with the SLIDEE.
		 *
		 * @return {Void}
		 */
		function syncScrollbar() {
			if (!el_handle) return;

			hPos.cur = pos.start === pos.end ? 0 : (((dragging.init && !dragging.slidee) ? pos.dest : pos.cur) - pos.start) / (pos.end - pos.start) * hPos.end;
			hPos.cur = within(round(hPos.cur), hPos.start, hPos.end);

			if (last.hPos !== hPos.cur) {
				last.hPos = hPos.cur;
				el_handle.style[transform] = gpuAcceleration + 'translateX' + '(' + hPos.cur + 'px)';
			}
		}

		/**
		 * Synchronizes pagesbar with SLIDEE.
		 *
		 * @return {Void}
		 */
		function syncPagesbar() {
			if (el_pages && last.page !== rel.activePage) {
				last.page = rel.activePage;

				[].forEach.call(el_pages, function (item) {
					item.classList.remove(o.activeClass)
				});

				el_pages[rel.activePage].classList.add(o.activeClass);
				trigger('activePage', last.page);
			}
		}

		/**
		 * Returns the position object.
		 *
		 * @param {Mixed} item
		 *
		 * @return {Object}
		 */
		self.getPos = function (item) {
			if (itemNav) {
				let index = getIndex(item);
				return index !== -1 ? items[index] : false;
			} else {
				let el_item = el_slides_box.querySelector(item);

				if (el_item) {
					let offset = el_item.offsetLeft - el_slides_box.offsetLeft,
						size = el_item.offsetWidth;

					return {
						start: offset,
						center: offset - frameSize / 2 + size / 2,
						end: offset - frameSize + size,
						size: size
					};
				} else {
					return false;
				}
			}
		};

		/**
		 * Continuous move in a specified direction.
		 *
		 * @param  {Bool} forward True for forward movement, otherwise it'll go backwards.
		 * @param  {Int}  speed   Movement speed in pixels per frame. Overrides options.moveBy value.
		 *
		 * @return {Void}
		 */
		self.moveBy = function (speed) {
			move.speed = speed;
			// If already initiated, or there is nowhere to move, abort
			if (dragging.init || !move.speed || pos.cur === (move.speed > 0 ? pos.end : pos.start)) {
				return;
			}
			// Initiate move object
			move.lastTime = +new Date();
			move.startPos = pos.cur;
			// Set dragging as initiated
			continuousInit('button');
			dragging.init = 1;
			// Start movement
			trigger('moveStart');
			cAF(continuousID);
			moveLoop();
		};

		/**
		 * Continuous movement loop.
		 *
		 * @return {Void}
		 */
		function moveLoop() {
			// If there is nowhere to move anymore, stop
			if (!move.speed || pos.cur === (move.speed > 0 ? pos.end : pos.start)) {
				self.stop();
			}
			// Request new move loop if it hasn't been stopped
			continuousID = dragging.init ? rAF(moveLoop) : 0;
			// Update move object
			move.now = +new Date();
			move.pos = pos.cur + (move.now - move.lastTime) / 1000 * move.speed;
			// Slide
			slideTo(dragging.init ? move.pos : round(move.pos));
			// Normally, this is triggered in render(), but if there
			// is nothing to render, we have to do it manually here.
			if (!dragging.init && pos.cur === pos.dest) {
				trigger('moveEnd');
			}
			// Update times for future iteration
			move.lastTime = move.now;
		}

		/**
		 * Stops continuous movement.
		 *
		 * @return {Void}
		 */
		self.stop = function () {
			if (dragging.source === 'button') {
				dragging.init = 0;
				dragging.released = 1;
			}
		};

		/**
		 * Activate previous item.
		 *
		 * @return {Void}
		 */
		self.prev = function () {
			self.activate(rel.activeItem == null ? 0 : rel.activeItem - 1);
		};

		/**
		 * Activate next item.
		 *
		 * @return {Void}
		 */
		self.next = function () {
			self.activate(rel.activeItem == null ? 0 : rel.activeItem + 1);
		};

		/**
		 * Activate previous page.
		 *
		 * @return {Void}
		 */
		self.prevPage = function () {
			let index_new = rel.activePage - 1,
				index_old = rel.activePage;

			self.activatePage(index_new);
			trigger('changePage', index_new, index_old);
		};

		/**
		 * Activate next page.
		 *
		 * @return {Void}
		 */
		self.nextPage = function () {
			let index_new = rel.activePage + 1,
				index_old = rel.activePage;

			self.activatePage(index_new);
			trigger('changePage', index_new, index_old);
		};

		/**
		 * Slide SLIDEE by amount of pixels.
		 *
		 * @param {Int}  delta     Pixels/Items. Positive means forward, negative means backward.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.slideBy = function (delta, immediate) {
			if (!delta) return;

			if (itemNav) {
				self[centeredNav ? 'toCenter' : 'toStart'](
					within((centeredNav ? rel.centerItem : rel.firstItem) + o.scrollBy * delta, 0, items.length)
				);
			} else {
				slideTo(pos.dest + delta, immediate);
			}
		};

		/**
		 * Animate SLIDEE to a specific position.
		 *
		 * @param {Int}  pos       New position.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.slideTo = function (pos, immediate) {
			slideTo(pos, immediate);
		};

		/**
		 * Core method for handling `toLocation` methods.
		 *
		 * @param  {String} location
		 * @param  {Mixed}  item
		 * @param  {Bool}   immediate
		 *
		 * @return {Void}
		 */
		function to(location, item, immediate) {
			// Optional arguments logic
			if (type(item) === 'boolean') {
				immediate = item;
				item = undefined;
			}

			if (item === undefined) {
				slideTo(pos[location], immediate);
			} else {
				// You can't align items to sides of the frame
				// when centered navigation type is enabled
				if (centeredNav && location !== 'center') {
					return;
				}

				var itemPos = self.getPos(item);
				if (itemPos) {
					slideTo(itemPos[location], immediate, !centeredNav);
				}
			}
		}

		/**
		 * Animate element or the whole SLIDEE to the start of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.toStart = function (item, immediate) {
			to('start', item, immediate);
		};

		/**
		 * Animate element or the whole SLIDEE to the end of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.toEnd = function (item, immediate) {
			to('end', item, immediate);
		};

		/**
		 * Animate element or the whole SLIDEE to the center of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
		self.toCenter = function (item, immediate) {
			to('center', item, immediate);
		};

		/**
		 * Get the index of an item in SLIDEE.
		 *
		 * @param {Mixed} item     Item DOM element.
		 *
		 * @return {Int}  Item index, or -1 if not found.
		 */
		function getIndex(item) {
			return item != null ?
				isNumber(item) ?
					item >= 0 && item < items.length ? item : -1 :
					[].slice.call(el_items).indexOf(item) :
				-1;
		}

		// Expose getIndex without lowering the compressibility of it,
		// as it is used quite often throughout Sly.
		self.getIndex = getIndex;

		/**
		 * Get index of an item in SLIDEE based on a variety of input types.
		 *
		 * @param  {Mixed} item DOM element, positive or negative integer.
		 *
		 * @return {Int}   Item index, or -1 if not found.
		 */
		function getRelativeIndex(item) {
			return getIndex(isNumber(item) && item < 0 ? item + items.length : item);
		}

		/**
		 * Activates an item.
		 *
		 * @param  {Mixed} item Item DOM element, or index starting at 0.
		 *
		 * @return {Mixed} Activated item index or false on fail.
		 */
		function activate(item, force) {
			let index = getIndex(item);

			if (!itemNav || index < 0) return false;

			// Update classes, last active index, and trigger active event only when there
			// has been a change. Otherwise just return the current active index.
			if (last.active !== index || force) {
				// Update classes
				el_items[rel.activeItem || 0].classList.remove(o.activeClass);
				el_items[index].classList.add(o.activeClass);

				last.active = rel.activeItem = index;

				updateButtonsState();
				trigger('active', index);
			}

			return index;
		}

		/**
		 * Activates an item and helps with further navigation when o.smart is enabled.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0.
		 * @param {Bool}  immediate Whether to reposition immediately in smart navigation.
		 *
		 * @return {Void}
		 */
		self.activate = function (item, immediate) {
			let index = activate(item);

			if (index === false) return;

			// When centeredNav is enabled, center the element.
			// Otherwise, determine where to position the element based on its current position.
			// If the element is currently on the far end side of the frame, assume that user is
			// moving forward and animate it to the start of the visible frame, and vice versa.
			if (centeredNav) {
				self.toCenter(index, immediate);
			} else if (index >= rel.lastItem) {
				self.toStart(index, immediate);
			} else if (index <= rel.firstItem) {
				self.toEnd(index, immediate);
			} else {
				resetCycle();
			}
		};

		/**
		 * Activates a page.
		 *
		 * @param {Int}  index     Page index, starting from 0.
		 * @param {Bool} immediate Whether to reposition immediately without animation.
		 *
		 * @return {Void}
		 */
		self.activatePage = function (index, immediate) {
			if (!isNumber(index)) return;

			slideTo(pages[within(index, 0, pages.length - 1)], immediate);
		};

		/**
		 * Return relative positions of items based on their visibility within FRAME.
		 *
		 * @param {Int} slideePos Position of SLIDEE.
		 *
		 * @return {Void}
		 */
		function getRelatives(slideePos) {
			slideePos = within(isNumber(slideePos) ? slideePos : pos.dest, pos.start, pos.end);

			var relatives = {};
			var centerOffset = forceCenteredNav ? 0 : frameSize / 2;

			// Determine active page
			if (!parallax) {
				for (var p = 0, pl = pages.length; p < pl; p++) {
					if (slideePos >= pos.end || p === pages.length - 1) {
						relatives.activePage = pages.length - 1;
						break;
					}

					if (slideePos <= pages[p] + centerOffset) {
						relatives.activePage = p;
						break;
					}
				}
			}

			// Relative item indexes
			if (itemNav) {
				var first = false;
				var last = false;
				var center = false;

				// From start
				for (var i = 0, il = items.length; i < il; i++) {
					// First item
					if (first === false && slideePos <= items[i].start + items[i].half) {
						first = i;
					}

					// Center item
					if (center === false && slideePos <= items[i].center + items[i].half) {
						center = i;
					}

					// Last item
					if (i === il - 1 || slideePos <= items[i].end + items[i].half) {
						last = i;
						break;
					}
				}

				// Safe assignment, just to be sure the false won't be returned
				relatives.firstItem = isNumber(first) ? first : 0;
				relatives.centerItem = isNumber(center) ? center : relatives.firstItem;
				relatives.lastItem = isNumber(last) ? last : relatives.centerItem;
			}

			return relatives;
		}

		/**
		 * Update object with relative positions.
		 *
		 * @param {Int} newPos
		 *
		 * @return {Void}
		 */
		function updateRelatives(newPos) {
			let relatives = getRelatives(newPos);

			for (let key in relatives) {
				rel[key] = relatives[key]
			}
		}

		/**
		 * Disable navigation buttons when needed.
		 *
		 * Adds disabledClass, and when the button is <button> or <input>, activates :disabled state.
		 *
		 * @return {Void}
		 */
		function updateButtonsState() {
			let isStart = pos.dest <= pos.start,
				isEnd = pos.dest >= pos.end,
				slideePosState = (isStart ? 1 : 0) | (isEnd ? 2 : 0);

			// Update paging buttons only if there has been a change in SLIDEE position
			if (last.slideePosState !== slideePosState) {
				last.slideePosState = slideePosState;

				if (el_prevPageButton) {
					el_prevPageButton.disabled = isStart;
					el_prevPageButton.classList.toggle(o.disabledClass, isStart);
				}

				if (el_nextPageButton) {
					el_nextPageButton.disabled = isEnd;
					el_nextPageButton.classList.toggle(o.disabledClass, isEnd);
				}

				if (el_backwardButton)
					el_backwardButton.classList.toggle(o.disabledClass, isStart);

				if (el_forwardButton)
					el_forwardButton.classList.toggle(o.disabledClass, isEnd);
			}

			// Forward & Backward buttons need a separate state caching because we cannot "property disable"
			// them while they are being used, as disabled buttons stop emitting mouse events.
			if (last.fwdbwdState !== slideePosState && dragging.released) {
				last.fwdbwdState = slideePosState;

				if (el_backwardButton)
					el_backwardButton.disabled = isStart;
				if (el_forwardButton)
					el_forwardButton.disabled = isEnd;
			}

			// Item navigation
			if (itemNav && rel.activeItem != null) {
				let isFirst = rel.activeItem === 0,
					isLast = rel.activeItem >= items.length - 1,
					itemsButtonState = (isFirst ? 1 : 0) | (isLast ? 2 : 0);

				if (last.itemsButtonState !== itemsButtonState) {
					last.itemsButtonState = itemsButtonState;

					if (el_prevButton) {
						el_prevButton.disabled = isFirst;
						el_prevButton.classList.toggle(o.disabledClass, isFirst);
					}

					if (el_nextButton) {
						el_nextButton.disabled = isLast;
						el_nextButton.classList.toggle(o.disabledClass, isLast);
					}
				}
			}
		}

		/**
		 * Resume cycling.
		 *
		 * @param {Int} priority Resume pause with priority lower or equal than this. Used internally for pauseOnHover.
		 *
		 * @return {Void}
		 */
		self.resume = function (priority) {
			if (!o.cycleBy || !o.cycleInterval || o.cycleBy === 'items' && (!items[0] || rel.activeItem == null) || priority < self.isPaused) {
				return;
			}

			self.isPaused = 0;

			if (cycleID) {
				cycleID = clearTimeout(cycleID);
			} else {
				trigger('resume');
			}

			cycleID = setTimeout(function () {
				trigger('cycle');
				switch (o.cycleBy) {
					case 'items':
						self.activate(rel.activeItem >= items.length - 1 ? 0 : rel.activeItem + 1);
						break;

					case 'pages':
						self.activatePage(rel.activePage >= pages.length - 1 ? 0 : rel.activePage + 1);
						break;
				}
			}, o.cycleInterval);
		};

		/**
		 * Pause cycling.
		 *
		 * @param {Int} priority Pause priority. 100 is default. Used internally for pauseOnHover.
		 *
		 * @return {Void}
		 */
		self.pause = function (priority) {
			if (priority < self.isPaused) {
				return;
			}

			self.isPaused = priority || 100;

			if (cycleID) {
				cycleID = clearTimeout(cycleID);
				trigger('pause');
			}
		};

		/**
		 * Toggle cycling.
		 *
		 * @return {Void}
		 */
		self.toggle = function () {
			self[cycleID ? 'pause' : 'resume']();
		};

		/**
		 * Updates a signle or multiple option values.
		 *
		 * @param {Mixed} name  Name of the option that should be updated, or object that will extend the options.
		 * @param {Mixed} value New option value.
		 *
		 * @return {Void}
		 */
		self.set = function (name, value) {
			if ($.isPlainObject(name)) {
				$.extend(o, name);
			} else if (o.hasOwnProperty(name)) {
				o[name] = value;
			}
		};

		/**
		 * Add one or multiple items to the SLIDEE end, or a specified position index.
		 *
		 * @param {Mixed} element Node element, or HTML string.
		 * @param {Int}   index   Index of a new item position. By default item is appended at the end.
		 *
		 * @return {Void}
		 */
		self.add = function (element, index) {
			if (itemNav) {
				// Insert the element(s)
				if (index == null || !items[0] || index >= items.length) {
					el_slides_box.insertAdjacentElement('beforeend', element)
				} else if (items.length) {
					items[index].el.insertAdjacentElement('beforebegin', element);
				}

				// Adjust the activeItem index
				if (rel.activeItem != null && index <= rel.activeItem) {
					last.active = rel.activeItem += $element.length;
				}
			} else {
				el_slides_box.insertAdjacentElement('beforeend', element)
			}

			// Reload
			load();
		};

		/**
		 * Remove an item from SLIDEE.
		 *
		 * @param {Mixed} element Item index, or DOM element.
		 * @param {Int}   index   Index of a new item position. By default item is appended at the end.
		 *
		 * @return {Void}
		 */
		self.remove = function (element) {
			if (itemNav) {
				var index = getRelativeIndex(element);

				if (index > -1) {
					// Remove the element
					el_items[index].parentElement.removeChild(el_items[index]);

					// If the current item is being removed, activate new one after reload
					let reactivate = index === rel.activeItem;

					// Adjust the activeItem index
					if (rel.activeItem != null && index < rel.activeItem) {
						last.active = --rel.activeItem;
					}

					// Reload
					load();

					// Activate new item at the removed position
					if (reactivate) {
						last.active = null;
						self.activate(rel.activeItem);
					}
				}
			} else {
				$(element).remove();
				load();
			}
		};

		/**
		 * Helps re-arranging items.
		 *
		 * @param  {Mixed} item     Item DOM element, or index starting at 0. Use negative numbers to select items from the end.
		 * @param  {Mixed} position Item insertion anchor. Accepts same input types as item argument.
		 * @param  {Bool}  after    Insert after instead of before the anchor.
		 *
		 * @return {Void}
		 */
		function moveItem(item, position, after) {
			item = getRelativeIndex(item);
			position = getRelativeIndex(position);

			// Move only if there is an actual change requested
			if (item > -1 && position > -1 && item !== position && (!after || position !== item - 1) && (after || position !== item + 1)) {
				el_items[item].insertAdjacentElement((after ? 'beforeend' : 'beforebegin'), items[position].el);

				let shiftStart = item < position ? item : (after ? position : position - 1),
					shiftEnd = item > position ? item : (after ? position + 1 : position),
					shiftsUp = item > position;

				// Update activeItem index
				if (rel.activeItem != null) {
					if (item === rel.activeItem) {
						last.active = rel.activeItem = after ? (shiftsUp ? position + 1 : position) : (shiftsUp ? position : position - 1);
					} else if (rel.activeItem > shiftStart && rel.activeItem < shiftEnd) {
						last.active = rel.activeItem += shiftsUp ? 1 : -1;
					}
				}

				// Reload
				load();
			}
		}

		/**
		 * Move item after the target anchor.
		 *
		 * @param  {Mixed} item     Item to be moved. Can be DOM element or item index.
		 * @param  {Mixed} position Target position anchor. Can be DOM element or item index.
		 *
		 * @return {Void}
		 */
		self.moveAfter = function (item, position) {
			moveItem(item, position, 1);
		};

		/**
		 * Move item before the target anchor.
		 *
		 * @param  {Mixed} item     Item to be moved. Can be DOM element or item index.
		 * @param  {Mixed} position Target position anchor. Can be DOM element or item index.
		 *
		 * @return {Void}
		 */
		self.moveBefore = function (item, position) {
			moveItem(item, position);
		};

		/**
		 * Registers callbacks.
		 *
		 * @param  {string} name  Event name, or callbacks map.
		 * @param  {Mixed} fn    Callback, or an array of callback functions.
		 *
		 * @return {Void}
		 */
		self.on = function (name, fn) {
			// Callbacks map
			if (type(name) === 'object') {
				for (var key in name) {
					if (name.hasOwnProperty(key)) {
						self.on(key, name[key]);
					}
				}
				// Callback
			} else if (type(fn) === 'function') {
				var names = name.split(' ');
				for (var n = 0, nl = names.length; n < nl; n++) {
					callbacks[names[n]] = callbacks[names[n]] || [];
					if (callbackIndex(names[n], fn) === -1) {
						callbacks[names[n]].push(fn);
					}
				}
				// Callbacks array
			} else if (type(fn) === 'array') {
				for (var f = 0, fl = fn.length; f < fl; f++) {
					self.on(name, fn[f]);
				}
			}
		};

		/**
		 * Registers callbacks to be executed only once.
		 *
		 * @param  {Mixed} name  Event name, or callbacks map.
		 * @param  {Mixed} fn    Callback, or an array of callback functions.
		 *
		 * @return {Void}
		 */
		self.one = function (name, fn) {
			function proxy() {
				fn.apply(self, arguments);
				self.off(name, proxy);
			}

			self.on(name, proxy);
		};

		/**
		 * Remove one or all callbacks.
		 *
		 * @param  {String} name Event name.
		 * @param  {Mixed}  fn   Callback, or an array of callback functions. Omit to remove all callbacks.
		 *
		 * @return {Void}
		 */
		self.off = function (name, fn) {
			if (fn instanceof Array) {
				for (var f = 0, fl = fn.length; f < fl; f++) {
					self.off(name, fn[f]);
				}
			} else {
				var names = name.split(' ');
				for (var n = 0, nl = names.length; n < nl; n++) {
					callbacks[names[n]] = callbacks[names[n]] || [];
					if (fn == null) {
						callbacks[names[n]].length = 0;
					} else {
						var index = callbackIndex(names[n], fn);
						if (index !== -1) {
							callbacks[names[n]].splice(index, 1);
						}
					}
				}
			}
		};

		/**
		 * Returns callback array index.
		 *
		 * @param  {String}   name Event name.
		 * @param  {Function} fn   Function
		 *
		 * @return {Int} Callback array index, or -1 if isn't registered.
		 */
		function callbackIndex(name, fn) {
			for (var i = 0, l = callbacks[name].length; i < l; i++) {
				if (callbacks[name][i] === fn) {
					return i;
				}
			}
			return -1;
		}

		/**
		 * Reset next cycle timeout.
		 *
		 * @return {Void}
		 */
		function resetCycle() {
			if (dragging.released && !self.isPaused) {
				self.resume();
			}
		}

		/**
		 * Calculate SLIDEE representation of handle position.
		 *
		 * @param  {Int} handlePos
		 *
		 * @return {Int}
		 */
		function handleToSlidee(handlePos) {
			return round(within(handlePos, hPos.start, hPos.end) / hPos.end * (pos.end - pos.start)) + pos.start;
		}

		/**
		 * Keeps track of a dragging delta history.
		 *
		 * @return {Void}
		 */
		function draggingHistoryTick() {
			// Looking at this, I know what you're thinking :) But as we need only 4 history states, doing it this way
			// as opposed to a proper loop is ~25 bytes smaller (when minified with GCC), a lot faster, and doesn't
			// generate garbage. The loop version would create 2 new variables on every tick. Unexaptable!
			dragging.history[0] = dragging.history[1];
			dragging.history[1] = dragging.history[2];
			dragging.history[2] = dragging.history[3];
			dragging.history[3] = dragging.delta;
		}

		/**
		 * Initialize continuous movement.
		 *
		 * @return {Void}
		 */
		function continuousInit(source) {
			dragging.released = 0;
			dragging.source = source;
			dragging.slidee = source === 'slidee';
		}

		/**
		 * Dragging initiator.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function dragInit(event) {
			let isTouch = event.type === 'touchstart',
				source = this.source,
				isSlidee = source === 'slidee';

			// Ignore when already in progress, or interactive element in non-touch navivagion
			if (dragging.init || !isTouch && isInteractive(event.target)) {
				return;
			}

			// Handle dragging conditions
			if (source === 'handle' && (!o.dragHandle || hPos.start === hPos.end)) {
				return;
			}

			// SLIDEE dragging conditions
			if (isSlidee && !(isTouch ? o.touchDragging : o.mouseDragging && event.which < 2)) {
				return;
			}

			if (!isTouch) {
				// prevents native image dragging in Firefox
				stopDefault(event);
			}

			// Reset dragging object
			continuousInit(source);

			// Properties used in dragHandler
			dragging.init = 0;
			dragging.el_source = event.target;
			dragging.touch = isTouch;
			dragging.pointer = isTouch ? event.touches[0] : event;
			dragging.initX = dragging.pointer.pageX;
			dragging.initY = dragging.pointer.pageY;
			dragging.initPos = isSlidee ? pos.cur : hPos.cur;
			dragging.start = +new Date();
			dragging.time = 0;
			dragging.path = 0;
			dragging.delta = 0;
			dragging.locked = 0;
			dragging.history = [0, 0, 0, 0];
			dragging.pathToLock = isSlidee ? isTouch ? 30 : 10 : 0;

			// Bind dragging events
			document.addEventListener(isTouch ? 'touchmove' : 'mousemove', dragHandler, passiveSupported ? {passive: true} : false);
			document.addEventListener(isTouch ? 'touchend' : 'mouseup', dragHandler, passiveSupported ? {passive: true} : false);

			// Pause ongoing cycle
			self.pause(1);

			// Add dragging class
			(isSlidee ? el_slides_box : el_handle).classList.add(o.draggedClass);

			// Trigger moveStart event
			trigger('moveStart');

			// Keep track of a dragging path history. This is later used in the
			// dragging release swing calculation when dragging SLIDEE.
			if (isSlidee) {
				historyID = setInterval(draggingHistoryTick, 10);
			}
		}

		/**
		 * Handler for dragging scrollbar handle or SLIDEE.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function dragHandler(event) {
			dragging.released = event.type === 'mouseup' || event.type === 'touchend';
			dragging.pointer = dragging.touch ? event[dragging.released ? 'changedTouches' : 'touches'][0] : event;
			dragging.pathX = dragging.pointer.pageX - dragging.initX;
			dragging.pathY = dragging.pointer.pageY - dragging.initY;
			dragging.path = sqrt(pow(dragging.pathX, 2) + pow(dragging.pathY, 2));
			dragging.delta = dragging.pathX;

			if (!dragging.released && dragging.path < 1) return;

			// We haven't decided whether this is a drag or not...
			if (!dragging.init) {
				// If the drag path was very short, maybe it's not a drag?
				if (dragging.path < o.dragThreshold) {
					// If the pointer was released, the path will not become longer and it's
					// definitely not a drag. If not released yet, decide on next iteration
					return dragging.released ? dragEnd() : undefined;
				} else {
					// If dragging path is sufficiently long we can confidently start a drag
					// if drag is in different direction than scroll, ignore it
					if (abs(dragging.pathX) > abs(dragging.pathY)) {
						dragging.init = 1;
					} else {
						return dragEnd();
					}
				}
			}

			stopDefault(event);

			// Disable click on a source element, as it is unwelcome when dragging
			if (!dragging.locked && dragging.path > dragging.pathToLock && dragging.slidee) {
				dragging.locked = 1;
				dragging.el_source.addEventListener('click', disableOneEvent);
			}

			// Cancel dragging on release
			if (dragging.released) {
				dragEnd();

				// Adjust path with a swing on mouse release
				if (o.releaseSwing && dragging.slidee) {
					dragging.swing = (dragging.delta - dragging.history[0]) / 40 * 300;
					dragging.delta += dragging.swing;
					dragging.tweese = abs(dragging.swing) > 10;
				}
			}

			slideTo(dragging.slidee ? round(dragging.initPos - dragging.delta) : handleToSlidee(dragging.initPos + dragging.delta));
		}

		/**
		 * Stops dragging and cleans up after it.
		 *
		 * @return {Void}
		 */
		function dragEnd() {
			clearInterval(historyID);
			dragging.released = true;
			document.removeEventListener(dragging.touch ? 'touchmove' : 'mousemove', dragHandler);
			document.removeEventListener(dragging.touch ? 'touchend' : 'mouseup', dragHandler);
			(dragging.slidee ? el_slides_box : el_handle).classList.remove(o.draggedClass);

			// Make sure that disableOneEvent is not active in next tick.
			setTimeout(function () {
				dragging.el_source.removeEventListener('click', disableOneEvent);
			});

			// Normally, this is triggered in render(), but if there
			// is nothing to render, we have to do it manually here.
			if (pos.cur === pos.dest && dragging.init) {
				trigger('moveEnd');
			}

			// Resume ongoing cycle
			self.resume(1);

			dragging.init = 0;
		}

		/**
		 * Check whether element is interactive.
		 *
		 * @return {Boolean}
		 */
		function isInteractive(element) {
			return ~interactiveElements.indexOf(element.nodeName) || element.classList.contains(o.interactive);
		}

		/**
		 * Continuous movement cleanup on mouseup.
		 *
		 * @return {Void}
		 */
		function movementReleaseHandler() {
			self.stop();
			document.removeEventListener('mouseup', movementReleaseHandler);
		}

		/**
		 * Buttons navigation handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function buttonsHandler(event) {
			/*jshint validthis:true */
			stopDefault(event);
			switch (this) {
				case el_forwardButton:
				case el_backwardButton:
					self.moveBy(el_forwardButton === this ? o.moveBy : -o.moveBy);
					document.addEventListener('mouseup', movementReleaseHandler);
					break;

				case el_prevButton:
					self.prev();
					break;

				case el_nextButton:
					self.next();
					break;

				case el_prevPageButton:
					self.prevPage();
					break;

				case el_nextPageButton:
					self.nextPage();
					break;
			}
		}

		/**
		 * Mouse wheel delta normalization.
		 *
		 * @param  {Event} event
		 *
		 * @return {Int}
		 */
		function normalizeWheelDelta(event) {
			// wheelDelta needed only for IE8-
			scrolling.curDelta = ((event.deltaY || event.deltaX) || -event.wheelDelta);
			scrolling.curDelta /= event.deltaMode === 1 ? 3 : 100;
			if (!itemNav) {
				return scrolling.curDelta;
			}
			time = +new Date();
			if (scrolling.last < time - scrolling.resetTime) {
				scrolling.delta = 0;
			}
			scrolling.last = time;
			scrolling.delta += scrolling.curDelta;
			if (abs(scrolling.delta) < 1) {
				scrolling.finalDelta = 0;
			} else {
				scrolling.finalDelta = round(scrolling.delta / 1);
				scrolling.delta %= 1;
			}
			return scrolling.finalDelta;
		}

		/**
		 * Mouse scrolling handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function scrollHandler(event) {
			// Mark event as originating in a Sly instance
			event[namespace] = self;
			// Don't hijack global scrolling
			let time = +new Date();

			console.log('scrollHandler');

			if (lastGlobalWheel + o.scrollHijack > time) {
				lastGlobalWheel = time;
				return;
			}

			// Ignore if there is no scrolling to be done
			if (!o.scrollBy || pos.start === pos.end) return;

			let delta = normalizeWheelDelta(event);

			// Trap scrolling only when necessary and/or requested
			if (o.scrollTrap || delta > 0 && pos.dest < pos.end || delta < 0 && pos.dest > pos.start) {
				stopDefault(event, 1);
				self.slideBy(o.scrollBy * delta);
			}
		}

		/**
		 * Scrollbar click handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function scrollbarHandler(event) {
			// Only clicks on scroll bar. Ignore the handle.
			if (o.clickBar && event.target === el_sb) {
				stopDefault(event);
				// Calculate new handle position and sync SLIDEE to it
				slideTo(handleToSlidee(event.pageX - el_sb.offsetLeft - handleSize / 2));
			}
		}

		/**
		 * Keyboard input handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function keyboardHandler(event) {
			if (!o.keyboardNavBy) {
				return;
			}

			switch (event.which) {
				// Left
				case 37:
					stopDefault(event);
					self[o.keyboardNavBy === 'pages' ? 'prevPage' : 'prev']();
					break;

				// Right
				case 39:
					stopDefault(event);
					self[o.keyboardNavBy === 'pages' ? 'nextPage' : 'next']();
					break;
			}
		}

		/**
		 * Click on item activation handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function activateHandler(event) {
			/*jshint validthis:true */

			// Ignore clicks on interactive elements.
			if (isInteractive(this)) {
				event[namespace + 'ignore'] = true;
				return;
			}

			// Ignore events that:
			// - are not originating from direct SLIDEE children
			// - originated from interactive elements
			if (this.parentNode !== el_slides_box || event[namespace + 'ignore']) return;

			self.activate(this);
		}

		/**
		 * Click on page button handler.
		 *
		 * @param {Event} event
		 *
		 * @return {Void}
		 */
		function activatePageHandler(event) {
			/*jshint validthis:true */
			// Accept only events from direct pages bar children.
			if (event.target.parentNode !== el_pb) return;

			self.activatePage([].slice.call(el_pages).indexOf(event.target));
		}

		/**
		 * Pause on hover handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
		function pauseOnHoverHandler(event) {
			if (o.pauseOnHover) {
				self[event.type === 'mouseenter' ? 'pause' : 'resume'](2);
			}
		}

		/**
		 * Trigger callbacks for event.
		 *
		 * @param  {String} name Event name.
		 * @param  {Mixed}  argX Arguments passed to callbacks.
		 *
		 * @return {Void}
		 */
		function trigger(name, arg1, arg2) {
			if (!callbacks[name]) return;

			l = callbacks[name].length;
			// Callbacks will be stored and executed from a temporary array to not
			// break the execution queue when one of the callbacks unbinds itself.
			tmpArray.length = 0;
			for (i = 0; i < l; i++) {
				tmpArray.push(callbacks[name][i]);
			}
			// Execute the callbacks
			for (i = 0; i < l; i++) {
				tmpArray[i].call(self, name, arg1, arg2);
			}
		}

		/**
		 * Destroys instance and everything it created.
		 *
		 * @return {Void}
		 */
		self.destroy = function () {
			// Remove the reference to itself
			Sly.removeInstance(frame);

			// Unbind all events
			el_scrollSource
				.add(el_handle)
				.add(el_sb)
				.add(el_pb)
				.add(el_forwardButton)
				.add(el_backwardButton)
				.add(el_prevButton)
				.add(el_nextButton)
				.add(el_prevPageButton)
				.add(el_nextPageButton)
				.off('.' + namespace);

			// Unbinding specifically as to not nuke out other instances
			document.removeEventListener('keydown', keyboardHandler);

			// Remove classes
			el_prevButton
				.add(el_nextButton)
				.add(el_prevPageButton)
				.add(el_nextPageButton)
				.removeClass(o.disabledClass);

			if (el_items && rel.activeItem != null)
				el_items[rel.activeItem].classList.remove(o.activeClass);

			// Remove page items
			el_pb.innerHTML = '';

			if (!parallax) {
				// Unbind events from frame
				el_frame.removeEventListener('mouseenter', pauseOnHoverHandler);
				el_frame.removeEventListener('mouseleave', pauseOnHoverHandler);
				el_frame.removeEventListener('scroll', resetScroll);
				if (o.activateOn)
					el_frame.removeEventListener(o.activateOn, activateHandler);
				// Restore original styles
				frameStyles.restore();
				slideeStyles.restore();
				sbStyles.restore();
				handleStyles.restore();
				// Remove the instance from element data storage
				$.removeData(frame, namespace);
			}

			// Clean up collections
			items.length = pages.length = 0;
			last = {};

			// Reset initialized status and return the instance
			self.initialized = 0;
			return self;
		};

		/**
		 * Initialize.
		 *
		 * @return {Object}
		 */
		self.init = function () {
			requestAnimationFrame(function () {
				if (self.initialized) return;

				// Disallow multiple instances on the same element
				if (Sly.getInstance(frame)) throw new Error('There is already a Sly instance on this element');

				// Store the reference to itself
				Sly.storeInstance(frame, self);

				// Register callbacks map
				self.on(callbackMap);

				// Save styles
				let holderProps = ['overflow', 'position'],
					movableProps = ['position', 'webkitTransform', 'msTransform', 'transform', 'left', 'top', 'width', 'height'];

				frameStyles.save.apply(frameStyles, holderProps);
				sbStyles.save.apply(sbStyles, holderProps);
				slideeStyles.save.apply(slideeStyles, movableProps);
				handleStyles.save.apply(handleStyles, movableProps);

				// Set required styles
				if (el_handle) {
					if (!parallax) {
						el_frame.style.overflow = 'hidden';

						if (!transform && el_frame.style.position === 'static')
							el_frame.style.position = 'relative';

						el_slides_box.style.transform = gpuAcceleration;
					}

					el_handle.style.transform = gpuAcceleration;
				}

				// Navigation buttons
				if (o.forward) {
					el_forwardButton.addEventListener('mousedown', buttonsHandler);
				}
				if (o.backward)
					el_backwardButton.addEventListener('mousedown', buttonsHandler);
				if (o.prev)
					el_prevButton.addEventListener('click', buttonsHandler);
				if (o.next)
					el_nextButton.addEventListener('click', buttonsHandler);
				if (o.prevPage)
					el_prevPageButton.addEventListener('click', buttonsHandler);
				if (o.nextPage)
					el_nextPageButton.addEventListener('click', buttonsHandler);

				// Scrolling navigation
				if (o.scrollBy) {
					el_scrollSource.addEventListener('wheel', scrollHandler, passiveSupported ? {passive: true} : false);

					if (!globalwheelEvent) {
						globalwheelEvent = true;

						document.addEventListener('wheel', function (event) {
							let time = +new Date();

							console.log('document wheel');

							// Update last global wheel time, but only when event didn't originate
							// in Sly frame, or the origin was less than scrollHijack time ago
							if (!event[namespace] || o.scrollHijack < time - lastGlobalWheel) lastGlobalWheel = time;
						});
					}
				}

				// Clicking on scrollbar navigation
				if (el_sb)
					el_sb.addEventListener('click', scrollbarHandler);

				// Click on items navigation
				if (itemNav && o.activateOn)
					el_frame.addEventListener(o.activateOn, activateHandler);

				// Pages navigation
				if (el_pb && o.activatePageOn)
					el_pb.addEventListener(o.activatePageOn, activatePageHandler);

				// Dragging navigation
				el_dragSource.addEventListener('touchstart', {
					handleEvent: dragInit,
					source: 'slidee'
				});
				el_dragSource.addEventListener('mousedown', {
					handleEvent: dragInit,
					source: 'slidee'
				});

				// Scrollbar dragging navigation
				if (el_handle) {
					el_handle.addEventListener('touchstart', {
						handleEvent: dragInit,
						source: 'handle'
					});
					el_handle.addEventListener('mousedown', {
						handleEvent: dragInit,
						source: 'handle'
					});
				}

				// Keyboard navigation
				document.addEventListener('keydown', keyboardHandler);

				if (!parallax) {
					// Pause on hover
					el_frame.addEventListener('mouseenter', pauseOnHoverHandler);
					el_frame.addEventListener('mouseleave', pauseOnHoverHandler);
					// Reset native FRAME element scroll
					el_frame.addEventListener('scroll', resetScroll);
				}

				// Mark instance as initialized
				self.initialized = 1;

				// Load
				load(true);

				// Initiate automatic cycling
				if (o.cycleBy && !parallax) {
					self[o.startPaused ? 'pause' : 'resume']();
				}

				// Return instance
				return self;
			});
		};

		Sly.getInstance = function (element) {
			return element[namespace];
		};

		Sly.storeInstance = function (element, sly) {
			return element[namespace] = sly;
		};
	}

	Sly.removeInstance = function (element) {
		return $.removeData(element, namespace);
	};

	/**
	 * Return type of the value.
	 *
	 * @param  {Mixed} value
	 *
	 * @return {String}
	 */
	function type(value) {
		if (value == null) {
			return String(value);
		}

		if (typeof value === 'object' || typeof value === 'function') {
			return Object.prototype.toString.call(value).match(/\s([a-z]+)/i)[1].toLowerCase() || 'object';
		}

		return typeof value;
	}

	/**
	 * Event preventDefault & stopPropagation helper.
	 *
	 * @param {Event} event     Event object.
	 * @param {Bool}  noBubbles Cancel event bubbling.
	 *
	 * @return {Void}
	 */
	function stopDefault(event, noBubbles) {
		event.preventDefault();
		if (noBubbles) event.stopPropagation();
	}

	/**
	 * Disables an event it was triggered on and unbinds itself.
	 *
	 * @param  {Event} event
	 *
	 * @return {Void}
	 */
	function disableOneEvent(event) {
		/*jshint validthis:true */
		stopDefault(event, 1);
		this.removeEventListener(event.type, disableOneEvent);
	}

	/**
	 * Resets native element scroll values to 0.
	 *
	 * @return {Void}
	 */
	function resetScroll() {
		/*jshint validthis:true */
		this.scrollLeft = 0;
		this.scrollTop = 0;
	}

	/**
	 * Check if variable is a number.
	 *
	 * @param {Mixed} value
	 *
	 * @return {Boolean}
	 */
	function isNumber(value) {
		return !isNaN(parseFloat(value)) && isFinite(value);
	}

	/**
	 * Parse style to pixels.
	 *
	 * @param {Element}   item    DOM element.
	 * @param {Property} property CSS property to get the pixels from.
	 *
	 * @return {Int}
	 */
	function getPx(item, property, computedStyle) {
		return round(parseFloat(computedStyle.getPropertyValue(property)));
	}

	/**
	 * Make sure that number is within the limits.
	 *
	 * @param {Number} number
	 * @param {Number} min
	 * @param {Number} max
	 *
	 * @return {Number}
	 */
	function within(number, min, max) {
		return number < min ? min : number > max ? max : number;
	}

	/**
	 * Saves element styles for later restoration.
	 *
	 * Example:
	 *   var styles = new StyleRestorer(frame);
	 *   styles.save('position');
	 *   element.style.position = 'absolute';
	 *   styles.restore(); // restores to state before the assignment above
	 *
	 * @param {Element} element
	 */
	function StyleRestorer(element) {
		let self = {};

		self.style = {};
		self.save = function () {
			if (!element || !element.nodeType) return;

			for (let i = 0; i < arguments.length; i++) {
				self.style[arguments[i]] = element.style[arguments[i]];
			}
			return self;
		};
		self.restore = function () {
			if (!element || !element.nodeType) return;

			for (let prop in self.style) {
				if (self.style.hasOwnProperty(prop)) element.style[prop] = self.style[prop];
			}
			return self;
		};
		return self;
	}

	// Expose class globally
	w[className] = Sly;

	// Default options
	Sly.defaults = {
		slidee: null,  // Selector, DOM element, or jQuery object with DOM element representing SLIDEE.
		visibleItems: null,

		// Item based navigation
		itemNav: null,  // Item navigation type. Can be: 'basic', 'centered', 'forceCentered'.
		itemSelector: null,  // Select only items that match this selector.
		smart: 1, // Repositions the activated item to help with further navigation.
		activateOn: null,  // Activate an item on this event. Can be: 'click', 'mouseenter', ...
		activateMiddle: false, // Always activate the item in the middle of the FRAME. forceCentered only.

		// Scrolling
		scrollSource: null,  // Element for catching the mouse wheel scrolling. Default is FRAME.
		scrollBy: 0,     // Pixels or items to move per one mouse scroll. 0 to disable scrolling.
		scrollHijack: 300,   // Milliseconds since last wheel event after which it is acceptable to hijack global scroll.
		scrollTrap: false, // Don't bubble scrolling when hitting scrolling limits.

		// Dragging
		dragSource: null,  // Selector or DOM element for catching dragging events. Default is FRAME.
		mouseDragging: false, // Enable navigation by dragging the SLIDEE with mouse cursor.
		touchDragging: false, // Enable navigation by dragging the SLIDEE with touch events.
		releaseSwing: false, // Ease out on dragging swing release.
		swingSpeed: 0.2,   // Swing synchronization speed, where: 1 = instant, 0 = infinite.
		elasticBounds: false, // Stretch SLIDEE position limits when dragging past FRAME boundaries.
		dragThreshold: 3,     // Distance in pixels before Sly recognizes dragging.
		interactive: null,  // Selector for special interactive elements.

		// Scrollbar
		scrollBar: null,  // Selector or DOM element for scrollbar container.
		dragHandle: false, // Whether the scrollbar handle should be draggable.
		dynamicHandle: false, // Scrollbar handle represents the ratio between hidden and visible content.
		minHandleSize: 50,    // Minimal height or width (depends on sly direction) of a handle in pixels.
		clickBar: false, // Enable navigation by clicking on scrollbar.
		syncSpeed: 0.5,   // Handle => SLIDEE synchronization speed, where: 1 = instant, 0 = infinite.

		// Pagesbar
		pagesBar: null, // Selector or DOM element for pages bar container.
		activatePageOn: null, // Event used to activate page. Can be: click, mouseenter, ...
		pageBuilder:          // Page item generator.
			function (index) {
				return '<div class="sly-pages__page">' + (index + 1) + '</div>';
			},

		// Navigation buttons
		forward: null, // Selector or DOM element for "forward movement" button.
		backward: null, // Selector or DOM element for "backward movement" button.
		prev: null, // Selector or DOM element for "previous item" button.
		next: null, // Selector or DOM element for "next item" button.
		prevPage: null, // Selector or DOM element for "previous page" button.
		nextPage: null, // Selector or DOM element for "next page" button.

		// Automated cycling
		cycleBy: null,  // Enable automatic cycling by 'items' or 'pages'.
		cycleInterval: 5000,  // Delay between cycles in milliseconds.
		pauseOnHover: false, // Pause cycling when mouse hovers over the FRAME.
		startPaused: false, // Whether to start in paused sate.

		// Mixed options
		moveBy: 300,     // Speed in pixels per second used by forward and backward buttons.
		speed: 0,       // Animations speed in milliseconds. 0 to disable animations.
		startAt: null,    // Starting offset in pixels or items.
		keyboardNavBy: null,    // Enable keyboard navigation by 'items' or 'pages'.

		// Classes
		draggedClass: 'dragged', // Class for dragged elements (like SLIDEE or scrollbar handle).
		activeClass: 'active',  // Class for active items and pages.
		disabledClass: 'disabled', // Class for disabled navigation elements.

		// Responsive
		responsive: [], // Array of objects with the breakpoint and settings keys from lower to higher resolution
	};
}(window));