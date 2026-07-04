#include "BoxOfficeNitroBridge.h"
#include <jsi/jsi.h>
#include <ReactCommon/CallInvoker.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

using namespace facebook::jsi;
using namespace std;

namespace boxoffice {

// ==================== VALUE CONVERTERS ====================

Value mapToJSIValue(Runtime& rt, const unordered_map<string, any>& map);
Value vectorToJSIValue(Runtime& rt, const vector<any>& vec);

Value anyToJSIValue(Runtime& rt, const any& val) {
    if (!val.has_value()) {
        return Value::null();
    }
    
    if (val.type() == typeid(string)) {
        return Value(rt, String::createFromUtf8(rt, any_cast<string>(val)));
    }
    if (val.type() == typeid(int)) {
        return Value(any_cast<int>(val));
    }
    if (val.type() == typeid(double)) {
        return Value(any_cast<double>(val));
    }
    if (val.type() == typeid(bool)) {
        return Value(any_cast<bool>(val));
    }
    if (val.type() == typeid(unordered_map<string, any>)) {
        return mapToJSIValue(rt, any_cast<unordered_map<string, any>>(val));
    }
    if (val.type() == typeid(vector<any>)) {
        return vectorToJSIValue(rt, any_cast<vector<any>>(val));
    }
    
    // Fallback to string
    return Value(rt, String::createFromUtf8(rt, "unknown"));
}

Value mapToJSIValue(Runtime& rt, const unordered_map<string, any>& map) {
    auto obj = Object(rt);
    for (const auto& [key, val] : map) {
        obj.setProperty(rt, key.c_str(), anyToJSIValue(rt, val));
    }
    return Value(rt, obj);
}

Value vectorToJSIValue(Runtime& rt, const vector<any>& vec) {
    auto arr = Array(rt, vec.size());
    for (size_t i = 0; i < vec.size(); i++) {
        arr.setValueAtIndex(rt, i, anyToJSIValue(rt, vec[i]));
    }
    return Value(rt, arr);
}

// ==================== HYBRID OBJECT ====================

BoxOfficeNitroBridge::BoxOfficeNitroBridge(shared_ptr<CallInvoker> jsInvoker)
    : jsInvoker_(jsInvoker) {}

BoxOfficeNitroBridge::~BoxOfficeNitroBridge() {}

// ==================== LIFECYCLE ====================

Value BoxOfficeNitroBridge::configure(Runtime& rt, const Value& config) {
    auto configMap = jsiValueToMap(rt, config);
    auto result = nativeConfigure(configMap);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::start(Runtime& rt) {
    auto result = nativeStart();
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::stop(Runtime& rt) {
    auto result = nativeStop();
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getStatus(Runtime& rt) {
    auto result = nativeGetStatus();
    return mapToJSIValue(rt, result);
}

// ==================== SEARCH ====================

Value BoxOfficeNitroBridge::search(Runtime& rt, const Value& query, const Value& page, const Value& perPage, const Value& subjectType, const Value& version) {
    auto params = unordered_map<string, any>{
        {"query", query.asString(rt).utf8(rt)},
        {"page", (int)page.asNumber()},
        {"per_page", (int)perPage.asNumber()},
        {"subject_type", subjectType.asString(rt).utf8(rt)},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("search", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::searchSuggestions(Runtime& rt, const Value& query, const Value& version) {
    auto params = unordered_map<string, any>{
        {"query", query.asString(rt).utf8(rt)},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("search_suggestions", params);
    return mapToJSIValue(rt, result);
}

// ==================== DISCOVERY ====================

Value BoxOfficeNitroBridge::getTrending(Runtime& rt, const Value& page, const Value& perPage, const Value& version) {
    auto params = unordered_map<string, any>{
        {"page", (int)page.asNumber()},
        {"per_page", (int)perPage.asNumber()},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_trending", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getHomepage(Runtime& rt, const Value& version) {
    auto params = unordered_map<string, any>{
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_homepage", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getHotContent(Runtime& rt, const Value& version) {
    auto params = unordered_map<string, any>{
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_hot_content", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getPopularSearches(Runtime& rt, const Value& version) {
    auto params = unordered_map<string, any>{
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_popular_searches", params);
    return mapToJSIValue(rt, result);
}

// ==================== DETAILS ====================

Value BoxOfficeNitroBridge::getMovieDetails(Runtime& rt, const Value& urlOrItem, const Value& version) {
    auto params = unordered_map<string, any>{
        {"url_or_item", urlOrItem.asString(rt).utf8(rt)},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_movie_details", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getTVSeriesDetails(Runtime& rt, const Value& urlOrItem, const Value& version) {
    auto params = unordered_map<string, any>{
        {"url_or_item", urlOrItem.asString(rt).utf8(rt)},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_tv_series_details", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getItemDetails(Runtime& rt, const Value& urlOrItem) {
    auto params = unordered_map<string, any>{
        {"url_or_item", urlOrItem.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_item_details", params);
    return mapToJSIValue(rt, result);
}

// ==================== DOWNLOADABLE FILES ====================

Value BoxOfficeNitroBridge::getDownloadableFiles(Runtime& rt, const Value& item, const Value& subjectType, const Value& version) {
    auto params = unordered_map<string, any>{
        {"item", jsiValueToAny(rt, item)},
        {"subject_type", subjectType.asString(rt).utf8(rt)},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_downloadable_files", params);
    return mapToJSIValue(rt, result);
}

// ==================== DOWNLOADS ====================

Value BoxOfficeNitroBridge::downloadMovie(Runtime& rt, const Value& title, const Value& quality, const Value& captionLanguage, const Value& downloadDir, const Value& year) {
    auto params = unordered_map<string, any>{
        {"title", title.asString(rt).utf8(rt)},
        {"quality", quality.asString(rt).utf8(rt)},
        {"caption_language", captionLanguage.asString(rt).utf8(rt)},
        {"download_dir", downloadDir.asString(rt).utf8(rt)},
        {"year", (int)year.asNumber()}
    };
    auto result = nativeSendCommand("download_movie", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::downloadTVSeries(Runtime& rt, const Value& title, const Value& season, const Value& episode, const Value& limit, const Value& quality, const Value& captionLanguage, const Value& downloadDir, const Value& autoMode) {
    auto params = unordered_map<string, any>{
        {"title", title.asString(rt).utf8(rt)},
        {"season", (int)season.asNumber()},
        {"episode", (int)episode.asNumber()},
        {"limit", (int)limit.asNumber()},
        {"quality", quality.asString(rt).utf8(rt)},
        {"caption_language", captionLanguage.asString(rt).utf8(rt)},
        {"download_dir", downloadDir.asString(rt).utf8(rt)},
        {"auto_mode", autoMode.asBool()}
    };
    auto result = nativeSendCommand("download_tv_series", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::getDownloadStatus(Runtime& rt, const Value& downloadId) {
    auto params = unordered_map<string, any>{};
    if (!downloadId.isUndefined() && !downloadId.isNull()) {
        params["download_id"] = downloadId.asString(rt).utf8(rt);
    }
    auto result = nativeSendCommand("get_download_status", params);
    return mapToJSIValue(rt, result);
}

Value BoxOfficeNitroBridge::cancelDownload(Runtime& rt, const Value& downloadId) {
    auto params = unordered_map<string, any>{
        {"download_id", downloadId.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("cancel_download", params);
    return mapToJSIValue(rt, result);
}

// ==================== RECOMMENDATIONS ====================

Value BoxOfficeNitroBridge::getRecommendations(Runtime& rt, const Value& urlOrItem, const Value& page, const Value& perPage, const Value& version) {
    auto params = unordered_map<string, any>{
        {"url_or_item", urlOrItem.asString(rt).utf8(rt)},
        {"page", (int)page.asNumber()},
        {"per_page", (int)perPage.asNumber()},
        {"version", version.asString(rt).utf8(rt)}
    };
    auto result = nativeSendCommand("get_recommendations", params);
    return mapToJSIValue(rt, result);
}

// ==================== EVENTS ====================

void BoxOfficeNitroBridge::emitEvent(Runtime& rt, const string& eventName, const unordered_map<string, any>& data) {
    jsInvoker_->invokeAsync([this, &rt, eventName, data]() {
        auto global = rt.global();
        auto emitProp = global.getProperty(rt, "__boxOfficeEmit");
        if (emitProp.isObject() && emitProp.asObject(rt).isFunction(rt)) {
            auto args = vector<Value>{
                Value(rt, String::createFromUtf8(rt, eventName)),
                mapToJSIValue(rt, data)
            };
            emitProp.asObject(rt).asFunction(rt).call(rt, args.data(), args.size());
        }
    });
}

// ==================== JSI HELPERS ====================

unordered_map<string, any> BoxOfficeNitroBridge::jsiValueToMap(Runtime& rt, const Value& value) {
    auto obj = value.asObject(rt);
    auto props = obj.getPropertyNames(rt);
    auto map = unordered_map<string, any>();
    
    for (size_t i = 0; i < props.size(rt); i++) {
        auto key = props.getValueAtIndex(rt, i).asString(rt).utf8(rt);
        auto val = obj.getProperty(rt, key.c_str());
        map[key] = jsiValueToAny(rt, val);
    }
    
    return map;
}

any BoxOfficeNitroBridge::jsiValueToAny(Runtime& rt, const Value& value) {
    if (value.isUndefined() || value.isNull()) {
        return any();
    }
    if (value.isString()) {
        return any(value.asString(rt).utf8(rt));
    }
    if (value.isNumber()) {
        double num = value.asNumber();
        if (num == (int)num) {
            return any((int)num);
        }
        return any(num);
    }
    if (value.isBool()) {
        return any(value.asBool());
    }
    if (value.isObject()) {
        auto obj = value.asObject(rt);
        if (obj.isArray(rt)) {
            auto arr = obj.asArray(rt);
            auto vec = vector<any>();
            for (size_t i = 0; i < arr.size(rt); i++) {
                vec.push_back(jsiValueToAny(rt, arr.getValueAtIndex(rt, i)));
            }
            return any(vec);
        }
        return any(jsiValueToMap(rt, value));
    }
    return any();
}

} // namespace boxoffice