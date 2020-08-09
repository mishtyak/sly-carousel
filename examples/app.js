[].forEach.call(document.querySelectorAll('.js_sly'), function (item) {
	new Sly(item, {
		itemNav: 'basic',
		visibleItems: 5,
		activateOn: 'click',
		mouseDragging: 1,
		touchDragging: 1,
		releaseSwing: 1,
		scrollBar: item.parentElement.querySelector('.js_sly-scrollbar'),
		scrollBy: 1,
		pagesBar: item.parentElement.querySelector('.js_sly-pages'),
		activatePageOn: 'click',
		speed: 300,
		elasticBounds: 1,
		dragHandle: 1,
		dynamicHandle: 1,
		clickBar: 1,
		responsive: [
			{
				breakpoint: 768,
				settings: {
					mouseDragging: 0,
					scrollBy: 0,
					visibleItems: 2
				}
			},
			{
				breakpoint: 992,
				settings: {
					mouseDragging: 0,
					scrollBy: 0,
					visibleItems: 4
				}
			}
		],
		// startAt: 3,
		forward: item.parentElement.querySelector('.js_sly-btn-forward'),
		backward: item.parentElement.querySelector('.js_sly-btn-backward'),
		prev: item.parentElement.querySelector('.js_sly-btn-prev'),
		next: item.parentElement.querySelector('.js_sly-btn-next'),
		prevPage: item.parentElement.querySelector('.js_sly-btn-prev-page'),
		nextPage: item.parentElement.querySelector('.js_sly-btn-next-page')
	}, {
		load: function () {
			console.log('sly. load arguments: ', this, arguments);
		}
	}).init();
});

const el_sly_basic_box = document.getElementById('js_sly-basic-box');

const sly_basic = new Sly('#js_sly-basic', {
	itemNav: 'basic',
	visibleItems: 5,
	activateOn: 'click',
	mouseDragging: 1,
	touchDragging: 1,
	releaseSwing: 1,
	scrollBar: el_sly_basic_box.querySelector('.js_sly-scrollbar'),
	scrollBy: 1,
	pagesBar: el_sly_basic_box.querySelector('.js_sly-pages'),
	activatePageOn: 'click',
	speed: 300,
	elasticBounds: 1,
	dragHandle: 1,
	dynamicHandle: 1,
	clickBar: 1,
	forward: el_sly_basic_box.querySelector('.js_sly-btn-forward'),
	backward: el_sly_basic_box.querySelector('.js_sly-btn-backward'),
	prev: el_sly_basic_box.querySelector('.js_sly-btn-prev'),
	next: el_sly_basic_box.querySelector('.js_sly-btn-next'),
	prevPage: el_sly_basic_box.querySelector('.js_sly-btn-prev-page'),
	nextPage: el_sly_basic_box.querySelector('.js_sly-btn-next-page')
}, {
	load: function () {
		console.log('sly. load arguments: ', this, arguments);
	}
}).init();

/*
// To Start button
$wrap.find('.toStart').on('click', function () {
    var item = $(this).data('item');
    // Animate a particular item to the start of the frame.
    // If no item is provided, the whole content will be animated.
    $frame.sly('toStart', item);
});

// To Center button
$wrap.find('.toCenter').on('click', function () {
    var item = $(this).data('item');
    // Animate a particular item to the center of the frame.
    // If no item is provided, the whole content will be animated.
    $frame.sly('toCenter', item);
});

// To End button
$wrap.find('.toEnd').on('click', function () {
    var item = $(this).data('item');
    // Animate a particular item to the end of the frame.
    // If no item is provided, the whole content will be animated.
    $frame.sly('toEnd', item);
});

// Add item
$wrap.find('.add').on('click', function () {
    $frame.sly('add', '<li>' + $slidee.children().length + '</li>');
});

// Remove item
$wrap.find('.remove').on('click', function () {
    $frame.sly('remove', -1);
});*/

const el_sly_centered_box = document.getElementById('js_sly-centered-box');

const sly_centered = new Sly('#js_sly-centered', {
	itemNav: 'centered',
	activateOn: 'click',
	mouseDragging: 1,
	touchDragging: 1,
	releaseSwing: 1,
	scrollBar: el_sly_centered_box.querySelector('.js_sly-scrollbar'),
	scrollBy: 1,
	pagesBar: el_sly_centered_box.querySelector('.js_sly-pages'),
	activatePageOn: 'click',
	speed: 300,
	elasticBounds: 1,
	dragHandle: 1,
	dynamicHandle: 1,
	clickBar: 1,
	forward: el_sly_centered_box.querySelector('.js_sly-btn-forward'),
	backward: el_sly_centered_box.querySelector('.js_sly-btn-backward'),
	prev: el_sly_centered_box.querySelector('.js_sly-btn-prev'),
	next: el_sly_centered_box.querySelector('.js_sly-btn-next'),
	prevPage: el_sly_centered_box.querySelector('.js_sly-btn-prev-page'),
	nextPage: el_sly_centered_box.querySelector('.js_sly-btn-next-page')
}, {
	load: function () {
		console.log('sly. load arguments: ', this, arguments);
	}
}).init();

const el_sly_force_centered_box = document.getElementById('js_sly-force-centered-box');

const sly_force_centered = new Sly('#js_sly-force-centered', {
	itemNav: 'forceCentered',
	activateOn: 'click',
	mouseDragging: 1,
	touchDragging: 1,
	releaseSwing: 1,
	scrollBar: el_sly_force_centered_box.querySelector('.js_sly-scrollbar'),
	scrollBy: 1,
	pagesBar: el_sly_force_centered_box.querySelector('.js_sly-pages'),
	activatePageOn: 'click',
	speed: 300,
	elasticBounds: 1,
	dragHandle: 1,
	dynamicHandle: 1,
	clickBar: 1,
	forward: el_sly_force_centered_box.querySelector('.js_sly-btn-forward'),
	backward: el_sly_force_centered_box.querySelector('.js_sly-btn-backward'),
	prev: el_sly_force_centered_box.querySelector('.js_sly-btn-prev'),
	next: el_sly_force_centered_box.querySelector('.js_sly-btn-next'),
	prevPage: el_sly_force_centered_box.querySelector('.js_sly-btn-prev-page'),
	nextPage: el_sly_force_centered_box.querySelector('.js_sly-btn-next-page')
}, {
	load: function () {
		console.log('sly. load arguments: ', this, arguments);
	}
}).init();