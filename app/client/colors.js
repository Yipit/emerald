/*
 * Emerald - Continuous Integration server focused on real-time interactions
 *
 *     Copyright (C) 2012  Yipit Inc. <coders@yipit.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var ansiColors = (function () {

    /**
     * Clas that handles various interactions with ansi colors, like
     * parsing, replacing by css style etc
     */
    function AnsiColors() { }


    AnsiColors.ANSI_PATTERNS = {
        0:  1 << 0,             // reset
        1:  1 << 1,             // bold
        3:  1 << 2,             // italics
        4:  1 << 3,             // underline
        30: 1 << 4,             // black foreground
        31: 1 << 5,             // red foreground
        32: 1 << 6,             // green foreground
        34: 1 << 7,             // blue foreground
        35: 1 << 8,             // magenta foreground
        36: 1 << 9,             // cyan foreground
        37: 1 << 10             // white foreground
    };

    AnsiColors.prototype = {

        /**
         * Just a shortcut to use `findAndReplace' with `styledElement'
         */
        ansi2html: function (s) {
            return this.findAndReplace(s, this.styledElement);
        },

        /**
         * Parses a string with ansi colors and calls the `replacement'
         * callback for each entry found
         */
        findAndReplace: function (s, replacement) {
            var regexp = /\\033\[([0-9;]+)*m/g;
            var iter = null;

            while (true) {
                var i, flags = 0;
                iter = regexp.exec(s);
                if (!(iter))
                    break;

                var elements = iter[1].split(';');
                for (i = 0; i < elements.length; i++) {
                    flags |= AnsiColors.ANSI_PATTERNS[parseInt(elements[i], 10)];
                }
                s = s.replace('\x1b[' + iter[1] + 'm', replacement(flags));
            }
            return s;
        },

        /**
         * Returns an html of an element with the "style" attribute
         * filled according to the `flags' attribute. The default tag
         * is "span".
         */
        styledElement: function (flags, tag) {
            var css = {
                'font-weight': null,
                'font-style': null,
                'color': null,
                'background-color': null
            };

            if (tag === undefined)
                tag = 'span';

            if (flags & AnsiColors.ANSI_PATTERNS[0]) // reset
                return '</' + tag + '>';

            if (flags & AnsiColors.ANSI_PATTERNS[1]) // bold
                css['font-weight'] = 'bold';

            if (flags & AnsiColors.ANSI_PATTERNS[3]) // italic
                css['font-style'] = 'italic';

            if (flags & AnsiColors.ANSI_PATTERNS[4]) // underline
                css['text-decoration'] = 'underline';

            if (flags & AnsiColors.ANSI_PATTERNS[30]) // black
                css.color = 'black';

            if (flags & AnsiColors.ANSI_PATTERNS[31]) // red
                css.color = 'red';

            if (flags & AnsiColors.ANSI_PATTERNS[32]) // green
                css.color = 'green';

            if (flags & AnsiColors.ANSI_PATTERNS[34]) // blue
                css.color = 'blue';

            if (flags & AnsiColors.ANSI_PATTERNS[35]) // magenta
                css.color = 'magenta';

            if (flags & AnsiColors.ANSI_PATTERNS[36]) // cyan
                css.color = 'lightblue';

            if (flags & AnsiColors.ANSI_PATTERNS[37]) // white
                css.color = 'white';

            var style = ' style="';
            for (var i in css) {
                if (css[i]) {
                    style += i + ':' + css[i] + ';';
                }
            }
            style += '"';

            return '<' + tag + style + '>';
        }
    };

    return new AnsiColors();
})();
