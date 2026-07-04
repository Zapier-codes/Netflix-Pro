#pragma once

#include <jsi/jsi.h>
#include <ReactCommon/CallInvoker.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>
#include <any>

using namespace facebook::jsi;
using namespace std;

namespace boxoffice {

class BoxOfficeNitroBridge {
public:
    BoxOfficeNitroBridge(shared_ptr<CallInvoker> jsInvoker);
    ~BoxOfficeNitroBridge();

    // Lifecycle
    Value configure(Runtime& rt, const Value& config);
    Value start(Runtime& rt);
    Value stop(Runtime& rt);
    Value getStatus(Runtime& rt);

    // Search
    Value search(Runtime& rt, const Value& query, const Value& page, const Value& perPage, const Value& subjectType, const Value& version);
    Value searchSuggestions(Runtime& rt, const Value& query, const Value& version);

    // Discovery
    Value getTrending(Runtime& rt, const Value& page, const Value& perPage, const Value& version);
    Value getHomepage(Runtime& rt, const Value& version);
    Value getHotContent(Runtime& rt, const Value& version);
    Value getPopularSearches(Runtime& rt, const Value& version);

    // Details
    Value getMovieDetails(Runtime& rt, const Value& urlOrItem, const Value& version);
    Value getTVSeriesDetails(Runtime& rt, const Value& urlOrItem, const Value& version);
    Value getItemDetails(Runtime& rt, const Value& urlOrItem);

    // Downloadable files
    Value getDownloadableFiles(Runtime& rt, const Value& item, const Value& subjectType, const Value& version);

    // Downloads
    Value downloadMovie(Runtime& rt, const Value& title, const Value& quality, const Value& captionLanguage, const Value& downloadDir, const Value& year);
    Value downloadTVSeries(Runtime& rt, const Value& title, const Value& season, const Value& episode, const Value& limit, const Value& quality, const Value& captionLanguage, const Value& downloadDir, const Value& autoMode);
    Value getDownloadStatus(Runtime& rt, const Value& downloadId);
    Value cancelDownload(Runtime& rt, const Value& downloadId);

    // Recommendations
    Value getRecommendations(Runtime& rt, const Value& urlOrItem, const Value& page, const Value& perPage, const Value& version);

    // Events
    void emitEvent(Runtime& rt, const string& eventName, const unordered_map<string, any>& data);

    // Native hooks (implemented by platform-specific code)
    virtual unordered_map<string, any> nativeConfigure(const unordered_map<string, any>& config) = 0;
    virtual unordered_map<string, any> nativeStart() = 0;
    virtual unordered_map<string, any> nativeStop() = 0;
    virtual unordered_map<string, any> nativeGetStatus() = 0;
    virtual unordered_map<string, any> nativeSendCommand(const string& command, const unordered_map<string, any>& params) = 0;

private:
    shared_ptr<CallInvoker> jsInvoker_;
    
    unordered_map<string, any> jsiValueToMap(Runtime& rt, const Value& value);
    any jsiValueToAny(Runtime& rt, const Value& value);
};

} // namespace boxoffice