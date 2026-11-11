(function () {
	'use strict';

	function cssNumber(element, propertyName) {
		var value = window.getComputedStyle(element).getPropertyValue(propertyName);
		var number = parseFloat(value);
		return Number.isFinite(number) ? number : 0;
	}

	function cssLength(element, propertyName) {
		var styles = window.getComputedStyle(element);
		var value = styles.getPropertyValue(propertyName).trim();
		var number = parseFloat(value);

		if (!Number.isFinite(number)) {
			return 0;
		}

		if (value.endsWith('rem')) {
			return number * (parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16);
		}

		if (value.endsWith('em')) {
			return number * (parseFloat(styles.fontSize) || 16);
		}

		return number;
	}

	function syncBreakoutWidth(display) {
		applyContainerMode(display);
		if (display.classList.contains('is-contained')) {
			display.style.setProperty('--tabloria-breakout-offset', '0px');
			return;
		}

		if (!display.classList.contains('is-width-wide') && !display.classList.contains('is-width-full')) {
			return;
		}

		var viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
		if (!viewportWidth) {
			return;
		}

		display.style.setProperty('--tabloria-viewport-width', viewportWidth + 'px');
		display.style.setProperty('--tabloria-viewport-half', (viewportWidth / 2) + 'px');

		var currentOffset = cssNumber(display, '--tabloria-breakout-offset');
		var rect = display.getBoundingClientRect();
		var unshiftedLeft = rect.left - currentOffset;
		var targetLeft = Math.max(0, (viewportWidth - rect.width) / 2);

		if (display.classList.contains('is-width-full')) {
			targetLeft = Math.min(cssLength(display, '--tabloria-full-width-gutter'), viewportWidth / 2);
		}

		var nextOffset = targetLeft - unshiftedLeft;

		display.style.setProperty('--tabloria-breakout-offset', (Math.abs(nextOffset) < 0.5 ? 0 : nextOffset).toFixed(3) + 'px');
	}

	function syncBreakoutWidths(displays) {
		displays.forEach(syncBreakoutWidth);
	}

	function applyContainerMode(display) {
		var tableContainer = display.closest('td, th, .wp-block-table');
		var semanticContainer = display.closest('.wp-block-navigation, .wp-block-list, .wp-block-quote, blockquote');
		var unsafeContainer = tableContainer || semanticContainer;
		var width = display.parentElement ? display.parentElement.getBoundingClientRect().width : display.getBoundingClientRect().width;
		var fixedContained = display.dataset.contained === 'true';

		if (unsafeContainer) {
			display.classList.add('is-contained', 'is-unsafe-container');
			display.dataset.contained = 'true';
			fixedContained = true;
			maybeWarnUnsafeContainer(display, tableContainer ? 'table' : 'semantic');
		}

		if (width > 0 && width < 520) {
			display.classList.add('is-narrow-container', 'is-auto-contained', 'is-contained');
		} else {
			display.classList.remove('is-narrow-container');
			if (!fixedContained && display.classList.contains('is-auto-contained')) {
				display.classList.remove('is-contained');
			}
			display.classList.remove('is-auto-contained');
		}
	}

	function maybeWarnUnsafeContainer(display, reason) {
		if (!document.body.classList.contains('admin-bar') || display.querySelector('.tabloria-embed-warning')) {
			return;
		}

		var warning = document.createElement('div');
		warning.className = 'tabloria-embed-warning';
		warning.textContent = reason === 'table'
			? 'Tabloria Display is inside a table. Use Columns, Group, or Tabloria Display Grid instead.'
			: 'Tabloria Display is inside a semantic block. Use Group, Columns, or Tabloria Display Grid instead.';
		display.insertBefore(warning, display.firstChild);
	}

	function initDisplay(display) {
		initCouponActions(display);
		var cards = Array.prototype.slice.call(display.querySelectorAll('[data-tabloria-item]'));
		var search = display.querySelector('[data-tabloria-search]');
		var filters = Array.prototype.slice.call(display.querySelectorAll('[data-tabloria-filter]'));
		var pagination = display.querySelector('.tabloria-display__pagination');
		var status = display.querySelector('.tabloria-display__status');
		var empty = display.querySelector('.tabloria-display__empty');
		var perPage = parseInt(display.dataset.perPage || '12', 10);
		var usePagination = display.dataset.pagination === 'true';
		var showResultCount = display.dataset.showResultCount !== 'false';
		var hideRowsUntilSearch = display.dataset.hideRowsUntilSearch === 'true';
		var resetFilters = display.querySelector('[data-tabloria-reset-filters]');
		var currentPage = 1;

		function normalizeText(value) {
			return String(value || '').normalize('NFKC').toLocaleLowerCase();
		}

		function matches(card) {
			var query = search ? normalizeText(search.value.trim()) : '';
			if (hideRowsUntilSearch && search && !query) {
				return false;
			}
			if (query && normalizeText(card.dataset.search).indexOf(query) === -1) {
				return false;
			}

			return filters.every(function (filter) {
				var value = filter.value;
				if (!value) {
					return true;
				}
				return String(card.getAttribute('data-filter-' + filter.dataset.tabloriaFilter) || '') === value;
			});
		}

		function render() {
			var matched = cards.filter(matches);
			var totalPages = usePagination ? Math.max(1, Math.ceil(matched.length / perPage)) : 1;
			currentPage = Math.min(currentPage, totalPages);
			var start = usePagination ? (currentPage - 1) * perPage : 0;
			var end = usePagination ? start + perPage : matched.length;

			cards.forEach(function (card) {
				card.hidden = true;
			});

			matched.slice(start, end).forEach(function (card) {
				card.hidden = false;
			});

			if (empty) {
				empty.hidden = matched.length > 0;
			}

			renderStatus(start, end, matched.length);
			if (resetFilters) {
				resetFilters.hidden = !filters.some(function (filter) { return Boolean(filter.value); });
			}
			renderPagination(totalPages, matched.length);
			syncBreakoutWidth(display);
		}

		function renderStatus(start, end, totalItems) {
			if (!status) {
				return;
			}
			if (!showResultCount) {
				status.hidden = true;
				status.textContent = '';
				return;
			}
			status.hidden = false;

			if (totalItems === 0) {
				status.textContent = 'Showing 0 ' + (display.dataset.resultLabel || 'rows');
				return;
			}

			var label = display.dataset.resultLabel || 'rows';
			status.textContent = 'Showing ' + (start + 1) + ' to ' + Math.min(end, totalItems) + ' of ' + totalItems + ' ' + label;
		}

		function renderPagination(totalPages, totalItems) {
			if (!pagination) {
				return;
			}

			if (!usePagination || totalItems === 0) {
				pagination.innerHTML = '';
				return;
			}

			if (totalPages <= 1) {
				pagination.innerHTML = '<span class="tabloria-display__page-note">Page 1 of 1</span>';
				return;
			}

			var html = '<button type="button" data-page="' + Math.max(1, currentPage - 1) + '"' + (currentPage === 1 ? ' disabled' : '') + '>Prev</button>';
			for (var page = 1; page <= totalPages; page++) {
				if (totalPages > 7 && page > 2 && page < totalPages - 1 && Math.abs(page - currentPage) > 1) {
					if (page === 3 || page === totalPages - 2) {
						html += '<span class="tabloria-display__page-note">...</span>';
					}
					continue;
				}
				html += '<button type="button" class="' + (page === currentPage ? 'is-active' : '') + '" data-page="' + page + '">' + page + '</button>';
			}
			html += '<button type="button" data-page="' + Math.min(totalPages, currentPage + 1) + '"' + (currentPage === totalPages ? ' disabled' : '') + '>Next</button>';
			pagination.innerHTML = html;

			pagination.querySelectorAll('[data-page]').forEach(function (button) {
				button.addEventListener('click', function () {
					currentPage = parseInt(button.dataset.page, 10);
					render();
				});
			});
		}

		if (search) {
			search.addEventListener('input', function () {
				currentPage = 1;
				render();
			});
		}

		filters.forEach(function (filter) {
			filter.addEventListener('change', function () {
				currentPage = 1;
				render();
			});
		});

		if (resetFilters) {
			resetFilters.addEventListener('click', function () {
				filters.forEach(function (filter) { filter.value = ''; });
				if (search) { search.value = ''; }
				currentPage = 1;
				render();
			});
		}

		render();
	}

	function initCouponActions(display) {
		display.querySelectorAll('[data-tabloria-show-coupon]').forEach(function (trigger) {
			trigger.addEventListener('click', function () {
				var card = trigger.closest('.tabloria-coupon');
				var reveal = card ? card.querySelector('[data-tabloria-coupon-reveal]') : null;
				if (reveal) {
					reveal.hidden = false;
					trigger.setAttribute('aria-expanded', 'true');
				}
			});
		});

		display.querySelectorAll('[data-tabloria-copy-coupon]').forEach(function (button) {
			button.addEventListener('click', function () {
				var code = button.dataset.couponCode || '';
				copyCouponCode(code).then(function () {
					var reveal = button.closest('[data-tabloria-coupon-reveal]');
					var status = reveal ? reveal.querySelector('[data-tabloria-copy-status]') : null;
					if (status) {
						status.textContent = button.dataset.copiedLabel || 'Copied!';
					}
				}).catch(function () {
					var reveal = button.closest('[data-tabloria-coupon-reveal]');
					var status = reveal ? reveal.querySelector('[data-tabloria-copy-status]') : null;
					if (status) {
						status.textContent = 'Copy failed. Select the code and copy it manually.';
					}
				});
			});
		});
	}

	function copyCouponCode(code) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(code);
		}

		return new Promise(function (resolve, reject) {
			var input = document.createElement('textarea');
			input.value = code;
			input.setAttribute('readonly', '');
			input.style.position = 'fixed';
			input.style.opacity = '0';
			document.body.appendChild(input);
			input.select();
			var copied = document.execCommand && document.execCommand('copy');
			document.body.removeChild(input);
			if (copied) {
				resolve();
			} else {
				reject(new Error('Copy failed'));
			}
		});
	}

	document.addEventListener('DOMContentLoaded', function () {
		var displays = Array.prototype.slice.call(document.querySelectorAll('.tabloria-display'));
		var scheduleBreakoutSync = function () {
			window.requestAnimationFrame(function () {
				syncBreakoutWidths(displays);
			});
		};

		displays.forEach(applyContainerMode);
		if (document.querySelector('.tabloria-display.is-width-full:not(.is-contained)')) {
			document.documentElement.classList.add('tabloria-has-full-width-display');
		}
		displays.forEach(initDisplay);
		syncBreakoutWidths(displays);
		window.addEventListener('load', scheduleBreakoutSync);
		window.addEventListener('resize', scheduleBreakoutSync);
	});
})();
