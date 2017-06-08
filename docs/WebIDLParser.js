var csTypeNames = {
    'boolean': 'bool',
    'byte': 'byte',
    'short': 'short',
    'long': 'int',
    'long long': 'long',
    'double': 'double',
    'unsigned short': 'ushort',
    'unsigned long': 'uint',
    'unsigned long long': 'ulong',
    'float': 'float',
    'unrestricted float': 'float',
    'double': 'double',
    'unrestricted double': 'double',
    'domstring': 'string',
    'usvstring': 'string',
    'object': 'object',
    'void': 'void',
    'domhighRestimestamp': 'TimeSpan',
    'domtimestamp': 'TimeSpan',
    'octet': 'byte',
    'blob': 'FileInfo',
    'record': 'dictionary'
};

var basicTypes = [
    'void',
    'bool',
    'byte',
    'sbyte',
    'short',
    'ushort',
    'int',
    'uint',
    'long',
    'ulong',
    'float',
    'double',
    'string'
];

var primitiveDefaultValue = {
    bool: false,
    byte: 0,
    sbyte: 0,
    short: 0,
    ushort: 0,
    int: 0,
    uint: 0,
    long: 0,
    float: '0f',
    double: '0f',
    string: null
};

function WebIDLParse(docs, optimize) {
    var retrieveEnumTypes = (parseData, data) => {
        if (!data || typeof data !== 'object') return;
        if (data.csTypeName && data.proxyType === 'instanceId') {
            if (Object.keys(parseData.Enum).includes(data.csTypeName)) {
                data.proxyType = 'enum';
            }
        }
        Object.keys(data).forEach(key => {
            retrieveEnumTypes(parseData, data[key]);
        });
    };

    var typedefMatching = (parseData, data) => {
        if (!data || typeof data !== 'object') return;
        if (data.data_type) {
            if (!data.data_type.forEach) debugger;
            data.data_type.forEach((type, idx) => {
                if (Object.keys(parseData.Typedef).includes(type.typeName)) {
                    data.data_type.splice(idx, 1);
                    parseData.Typedef[type.typeName].data_type.forEach(type => {
                        data.data_type.push(type);
                    });
                }
            });
            data.data_type.forEach(type => addTypeInfo(type));
            if (data.optional) {
                if (data.data_type.some(dt => dt.proxyType === 'instanceId')) {
                    data.defaultValue = null;
                } else {
                    data.defaultValue = primitiveDefaultValue[data.data_type[0].csTypeName];
                }
            }
        }
        Object.keys(data).forEach(key => {
            typedefMatching(parseData, data[key]);
        });
    };

    var paramPatternParses = (parseData, data) => {
        if (!data || typeof data !== 'object') return;
        if (data.param_pattern) {
            paramPatternParse(data);
        }
        Object.keys(data).forEach(key => {
            paramPatternParses(parseData, data[key]);
        });
    };

    var groupParse = (parseData, group, groupElm) => {
        var groupData = parseData[group] = parseData[group] || {};
        var id = getText(groupElm.querySelector(`.idl${group}ID`));
        var groupItemData = groupData[id] = groupData[id] || {};
        extAttrParse(groupElm, groupItemData);
        var types = typeParse(groupElm.querySelector('.idlMaplike'));
        if (types) {
            parseData.Maplike = parseData.Maplike || {};
            parseData.Maplike[id] = types;
            if (types[0].readonly) parseData.Maplike[id].readonly = true;
            return;
        }
        switch (group) {
            case 'Dictionary':
            case 'Interface':
                var superclass = getText(groupElm.querySelector('.idlSuperclass'));
                if (superclass) groupItemData.Superclass = superclass;
                ['Ctor', 'Attribute', 'Member', 'Method'].forEach(memberKind => {
                    memberParse(groupElm, groupItemData, memberKind, id);
                })
                break;
            case 'Callback':
                memberParse(groupElm, groupItemData, 'Callback', id);
                var cbParams = paramParse(groupElm);
                if (cbParams) groupItemData.param = cbParams;
                break;
            case 'Typedef':
                var types = typeParse(groupElm.querySelector('.idlTypedefType'));
                groupItemData.data_type = types;
                break;
            case 'Enum':
                groupElm.querySelectorAll('.idlEnumItem').forEach(item => {
                    groupItemData.item = groupItemData.item || [];
                    groupItemData.item.push(getText(item).replace(/"/g, ''));
                });
                break;
        }
    };

    var memberParse = (groupElm, groupItemData, memberKind, id) => {
        var memberElms = groupElm.querySelectorAll(`.idl${memberKind}`);
        if (memberElms.length) {
            var memberData = null;
            memberElms.forEach(elm => {
                var memberKindClass = { Attribute: 'Attr', Method: 'Meth' }[memberKind] || memberKind;
                var memberName = getText(elm.querySelector(`.idl${memberKindClass}Name`));

                var types = typeParse(elm.querySelector(`.idlType, .idl${memberKindClass}Type`));
                if (types && types[0].typeName === 'EventHandler') {
                    groupItemData.EventHandler = groupItemData.EventHandler || {};
                    var eventName = memberName;
                    if (eventName.startsWith('on')) eventName = eventName.substr(2);
                    var elm = groupElm.ownerDocument.querySelector(`#event-${id.toLowerCase()}-${eventName.toLowerCase()}`);
                    if (!elm) {
                        elm = groupElm.ownerDocument.querySelector(`#event-${id.toLowerCase().replace('rtc', '')}-${eventName.toLowerCase()}`);
                    }
                    if (!elm) {
                        elm = groupElm.ownerDocument.querySelector(`#event-${eventName.toLowerCase()}`);
                    }
                    var eventInterface = 'Event';
                    if (elm) {
                        eventInterface = elm.parentElement.nextElementSibling.textContent.replace(/\n| /g, '');
                        if (eventInterface.includes('[')) {
                            eventInterface = eventInterface.substr(0, eventInterface.indexOf('['));
                        }
                    }
                    groupItemData.EventHandler[memberName] = eventInterface;
                    return;
                }

                memberData = groupItemData[memberKind] = groupItemData[memberKind] || {};
                var memberItemData = (memberName && memberName !== 'Constructor') ? memberData[memberName] = memberData[memberName] || {} : memberData;
                if (memberKind !== 'Ctor') {
                    if (types) memberItemData.data_type = types;
                    var typeDec = /([a-z]+?)<(.+?)>/i.exec(getText(elm));
                    var typeDecs = ['frozenarray', 'record', 'sequence'];
                    if (elm.className === 'idlAttribute') typeDecs.push('promise');
                    if (typeDec && !typeDecs.includes(typeDec[1].toLowerCase())) {
                        memberItemData[typeDec[1]] = true;
                    }
                }

                headerKeywordsParse(elm, memberItemData);
                extAttrParse(elm, memberItemData);

                var params = paramParse(elm);
                if (params) {
                    memberItemData.param_pattern = memberItemData.param_pattern || [];
                    memberItemData.param_pattern.push(params);
                }

                var defaultValue = getText(elm.querySelector(`.idl${memberKindClass}Value`));
                if (defaultValue) {
                    memberItemData.defaultValue = defaultValue.replace(/"/g, "'");
                }

                if (memberKind === 'Superclass') {
                    memberData = getText(elm);
                }
            });
        }
    };

    var appendMessage = (txt) => {
        var div = document.createElement('div');
        div.textContent = txt;
        document.body.appendChild(div);
    };

    var extAttrParse = (target, parseData) => {
        var extAttrElms = target.querySelectorAll(':scope > .extAttr');
        var extAttrs = [];
        extAttrElms.forEach(elm => {
            var extAttr = {};
            var name = getText(elm.querySelector('.extAttrName')).trim();
            if (!name) return;
            extAttr.extAttrName = name;
            var rhs = getText(elm.querySelector('.extAttrRhs'));
            if (rhs) extAttr.extAttrRhs = rhs;
            extAttrs.push(extAttr);
        });
        if (extAttrs.length) parseData.extAttr = extAttrs;
    };

    var nullObj = { textContent: '' };
    var getText = (elm) => {
        return (elm || nullObj).textContent.trim();
    }

    var headerKeywordsParse = (target, parseData) => {
        var keywords = getText(target).split(' ');
        keywords.forEach(keyword => {
            if (keyword === 'static') parseData.static = true;
            if (keyword === 'readonly') parseData.readonly = true;
            if (keyword === 'required') parseData.required = true;
            if (keyword === 'partial') parseData.partial = true;
        });
    };

    var paramParse = (target) => {
        var params = null;
        target.querySelectorAll('.idlParam').forEach(param => {
            params = params || [];
            var prm = {
                paramName: getText(param.querySelector('.idlParamName')),
                data_type: typeParse(param.querySelector('.idlParamType'))
            };
            var txt = getText(param);
            if (txt.startsWith('optional ')) {
                prm.optional = true;
            }
            var defaultValue = getText(param.querySelector('.idlDefaultValue'));
            if (defaultValue) {
                prm.defaultValue = defaultValue.replace(/"/g, "'");
            }
            headerKeywordsParse(param, prm);
            params.push(prm);
        });
        return params;
    };

    var typeParse = (typeElm, tn) => {
        if (!typeElm && !tn) return null;

        var types = [];
        var txt = tn || getText(typeElm);
        txt.replace(/\(|\)|\r|\n/g, '').split(' or ').forEach(typeName => {
            var typeDec = /([a-z]+?)<(.+?)>/i.exec(typeName);
            var typeDecs = ['frozenarray', 'record', 'sequence', 'maplike'];
            var type = {};
            if (typeDec) {
                if (typeElm.className === 'idlAttrType') typeDecs.push('promise');
                if (typeDecs.includes(typeDec[1].toLowerCase())) {
                    type[typeDec[1]] = true;
                }
                typeName = typeDec[2];
            }
            if (typeName.includes('<')) {
                type = Object.assign(type, typeParse(typeElm, typeName + '>', type));
                typeName = type.typeName;
            }
            var typeNames = typeName.split(',').map(x => x.trim());
            if (type.record || type.maplike) {
                var copy = Object.assign({}, type);
                delete copy.record;
                delete copy.maplike;
                type.key = Object.assign({}, copy);
                type.value = Object.assign({}, copy);
                type.key.typeName = typeNames[0];
                type.value.typeName = typeNames[1];
            } else if (typeName.endsWith('...')) {
                type.typeName = typeName.replace('...', '');
                var arrType = {
                    typeName: type.typeName,
                    array: true
                };
                types.push(arrType);
            } else {
                type.typeName = type.maplike ? typeNames : typeNames[0];
            }
            types.push(type);
        });
        if(tn) {
            return types[0];
        } else {
            return types;
        }
    };

    var addTypeInfo = (type) => {
        if (type.typeName.endsWith('?')) {
            type.typeName = type.typeName.substr(0, type.typeName.length - 1);
            type.nullable = true;
        }
        type.csTypeName = csTypeNames[type.typeName.toLowerCase()] || type.typeName;
        if (basicTypes.includes(type.csTypeName)) {
            type.proxyType = type.csTypeName;
        } else {
            if (type.array || type.sequence) {
                type.proxyType = 'json';
            } else {
                type.proxyType = 'instanceId';
            }
        }
    };

    var paramPatternParse = (data) => {
        for (var i = 0, il = data.param_pattern.length; i < il; i++) {
            var results = [];
            generateParamPattern(data.param_pattern[i], 0, [], results);
            var patterns = data.cs_param_pattern = data.cs_param_pattern || [];
            results.forEach((result, idx) => {
                if (patterns.length) {
                    var flg = false;
                    patterns.forEach(pattern => {
                        flg |= result.every((res, idx) => {
                            return res.data_type.sequence === pattern[idx].data_type.sequence &&
                                res.data_type.array === pattern[idx].data_type.array &&
                                res.data_type.csTypeName === pattern[idx].data_type.csTypeName;
                        });
                    });
                    if (!flg) {
                        patterns.push(result);
                    }
                } else {
                    patterns.push(result);
                }
            });
        }
    };

    var generateParamPattern = (param, idx, ptn, results) => {
        for (var i = 0, l = param[idx].data_type.length; i < l; i++) {
            var p = [].concat(ptn);
            var itm = {};
            Object.keys(param[idx]).forEach(key => {
                if (key !== 'data_type') itm[key] = param[idx][key];
            });
            itm.data_type = param[idx].data_type[i];
            p.push(itm);
            if (idx + 1 === param.length) {
                results.push(p);
            } else {
                generateParamPattern(param, idx + 1, p, results);
            }
        }
    };

    var parseData = {};
    docs.forEach(doc => {
        var groups = [...doc.querySelectorAll('.idl *[class$=ID]')]
            .map(elm => elm.className.replace(/^idl(.+?)ID$/, (a, b) => b))
            .filter((val, idx, arr) => arr.indexOf(val) === idx);
        groups.forEach(group => { // Dictionary, Interface, Enum, Callback ...
            doc.querySelectorAll(`.idl${group}`).forEach(groupElm => {
                var subElm = groupElm.querySelector('.idlDictionary');
                if (subElm) {
                    groupElm.removeChild(subElm);
                    groupParse(parseData, 'Dictionary', subElm);
                }
                groupParse(parseData, group, groupElm);
            });
        });
        if (optimize) {
            dataOptimize(parseData);
            dataOptimize2(parseData);
        }
    });
    retrieveEnumTypes(parseData, parseData);
    typedefMatching(parseData, parseData);
    paramPatternParses(parseData, parseData);
    return parseData;
}

