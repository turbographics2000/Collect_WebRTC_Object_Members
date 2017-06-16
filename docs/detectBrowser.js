function detectBrowser(userAgentString) {
    if (!userAgentString) return null;

    var browsers = [
        // Minor
        ['Android', /Android\s([0-9\.]+)/],
        ['BlackBerry10', /BB10;\sTouch.*Version\/([0-9\.]+)/],
        ['CriOS', /CriOS\/([0-9\.]+)(:?\s|$)/],
        ['Cyberfox', /Cyberfox\/([0-9\.]+)/],
        ['Waterfox', /Waterfox\/([0-9\.]+)/],
        ['Opera', /Opera\/([0-9\.]+)(?:\s|$)/],
        ['Opera', /OPR\/([0-9\.]+)/],
        ['Sleipnir', /Sleipnir\/([0-9\.]+)/],
        ['Iridium', /Iridium\/([0-9\.]+)(:?\s|$)/],
        ['Vivaldi', /Vivaldi\/([0-9\._]+)/],
        ['YandexBrowser', /YaBrowser\/([0-9\._]+)/],

        // Major
        ['Edge', /Edge\/([0-9\._]+)/],
        ['Chrome', /(?!Chrom.*OPR)Chrom(?:e|ium)\/([0-9\.]+)(:?\s|$)/],
        ['Firefox', /Firefox\/([0-9\.]+)(?:\s|$)/],
        ['IE', /Trident\/7\.0.*rv\:([0-9\.]+)\).*Gecko$/],
        ['IE', /MSIE\s([0-9\.]+);.*Trident\/[4-7].0/],
        ['IE', /MSIE\s(7\.0)/],
        ['iOS', /Version\/([0-9\._]+).*Mobile.*Safari.*/],
        ['Safari', /Version\/([0-9\._]+).*Safari/]
    ];

    return browsers.map(function (rule) {
        if (rule[1].test(userAgentString)) {
            var match = rule[1].exec(userAgentString);
            var version = match && match[1].split(/[._]/).slice(0, 3);

            if (version && version.length < 3) {
                Array.prototype.push.apply(version, (version.length == 1) ? [0, 0] : [0]);
            }

            return {
                name: rule[0],
                version: version.join('.')
            };
        }
    }).filter(Boolean).shift();
}