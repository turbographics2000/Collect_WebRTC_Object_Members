function detectBrowser(userAgentString) {
  if (!userAgentString) return null;

  var browsers = [
    [ 'Edge', /Edge\/([0-9\._]+)/ ],
    [ 'YandexBrowser', /YaBrowser\/([0-9\._]+)/ ],
    [ 'Vivaldi', /Vivaldi\/([0-9\._]+)/ ],
    [ 'Iridium', /Iridium\/([0-9\.]+)(:?\s|$)/],
    [ 'Chrome', /(?!Chrom.*OPR)Chrom(?:e|ium)\/([0-9\.]+)(:?\s|$)/ ],
    [ 'CriOS', /CriOS\/([0-9\.]+)(:?\s|$)/ ],
    [ 'Firefox', /Firefox\/([0-9\.]+)(?:\s|$)/ ],
    [ 'Opera', /Opera\/([0-9\.]+)(?:\s|$)/ ],
    [ 'Opera', /OPR\/([0-9\.]+)(:?\s|$)$/ ],
    [ 'Opera', /OPR\/([0-9\.]+)/ ],
    [ 'IE', /Trident\/7\.0.*rv\:([0-9\.]+)\).*Gecko$/ ],
    [ 'IE', /MSIE\s([0-9\.]+);.*Trident\/[4-7].0/ ],
    [ 'IE', /MSIE\s(7\.0)/ ],
    [ 'BlackBerry10', /BB10;\sTouch.*Version\/([0-9\.]+)/ ],
    [ 'Android', /Android\s([0-9\.]+)/ ],
    [ 'iOS', /Version\/([0-9\._]+).*Mobile.*Safari.*/ ],
    [ 'Safari', /Version\/([0-9\._]+).*Safari/ ]
  ];

  return browsers.map(function (rule) {
      if (rule[1].test(userAgentString)) {
          var match = rule[1].exec(userAgentString);
          var version = match && match[1].split(/[._]/).slice(0,3);

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