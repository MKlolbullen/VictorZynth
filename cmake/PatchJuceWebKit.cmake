# JUCE 9.0.2 only sets the Content-Type HTTP header for custom URI responses.
# WebKitGTK keeps the MIME type separately; an empty type interrupts the HTML
# load before JS/CSS requests. Patch only the pinned source, failing on drift.
set(source_file "${JUCE_SOURCE_DIR}/modules/juce_gui_extra/native/juce_WebBrowserComponent_linux.cpp")
file(READ "${source_file}" source)

if(source MATCHES "juce_webkit_uri_scheme_response_set_content_type")
    message(STATUS "JUCE WebKit content-type patch already present")
    return()
endif()

function(replace_once before after)
    string(FIND "${source}" "${before}" position)
    if(position EQUAL -1)
        message(FATAL_ERROR "Pinned JUCE WebKit patch anchor is missing")
    endif()
    string(REPLACE "${before}" "${after}" patched "${source}")
    set(source "${patched}" PARENT_SCOPE)
endfunction()

replace_once(
    "    JUCE_GENERATE_FUNCTION_WITH_DEFAULT (webkit_uri_scheme_response_set_http_headers,"
    "    JUCE_GENERATE_FUNCTION_WITH_DEFAULT (webkit_uri_scheme_response_set_content_type, juce_webkit_uri_scheme_response_set_content_type,
                                         (WebKitURISchemeResponse*, const gchar*), void)

    JUCE_GENERATE_FUNCTION_WITH_DEFAULT (webkit_uri_scheme_response_set_http_headers,"
)

replace_once(
    "                            makeSymbolBinding (juce_webkit_uri_scheme_response_set_http_headers,"
    "                            makeSymbolBinding (juce_webkit_uri_scheme_response_set_content_type,               \"webkit_uri_scheme_response_set_content_type\"),
                            makeSymbolBinding (juce_webkit_uri_scheme_response_set_http_headers,"
)

replace_once(
    "            wk.juce_webkit_uri_scheme_response_set_http_headers (webkitResponse, headers);"
    "            wk.juce_webkit_uri_scheme_response_set_content_type (webkitResponse, response->resource->mimeType.toRawUTF8());
            wk.juce_webkit_uri_scheme_response_set_http_headers (webkitResponse, headers);"
)

file(WRITE "${source_file}" "${source}")
message(STATUS "Applied JUCE WebKit response content-type fix")
