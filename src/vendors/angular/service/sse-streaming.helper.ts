/**
 * Emits Angular `Observable` Server-Sent Events (`text/event-stream`) streaming method bodies.
 *
 * @module vendors/angular/service/sse-streaming.helper
 */
import type { ServiceMethodModel } from "../../../functions/types.js";

/**
 * Appends Angular `Observable` SSE streaming reader statements to `lines`.
 *
 * @param lines - Target statement lines array.
 * @param model - Analyzed `ServiceMethodModel`.
 * @param bodyArgument - Serialized request body variable or `"null"`.
 */
export function emitAngularSseStreamingLines(
	lines: string[],
	model: ServiceMethodModel,
	bodyArgument: string,
): void {
	const sseMode = model.sseMode ?? "data";

	const hasSseDecoding =
		model.responseDecodingConfig &&
		Object.keys(model.responseDecodingConfig).length > 0;

	if (hasSseDecoding) {
		lines.push(
			`const sseDecodingConfig = ${JSON.stringify(model.responseDecodingConfig)};`,
		);
	}

	const bs = String.fromCharCode(92);
	lines.push(`
            return new Observable<${model.responseType}>(observer => { 
                const abortController = typeof AbortController !== 'undefined' ? new AbortController() : undefined; 
                const fetchHeaders = (() => { 
                    if (typeof Headers !== 'undefined') { 
                        const h = new Headers(); 
                        if (headers instanceof HttpHeaders) { 
                            headers.keys().forEach((key: string) => { 
                                const values = headers.getAll(key); 
                                if (values && values.length > 0) { 
                                    values.forEach((v: string) => h.append(key, v)); 
                                } else { 
                                    const value = headers.get(key); 
                                    if (value !== null) h.set(key, value); 
                                } 
                            }); 
                        } else if (headers) { 
                            Object.entries(headers as Record<string, string | number | boolean | object | undefined | null>).forEach(([key, value]) => { 
                                if (Array.isArray(value)) { 
                                    value.forEach((v: string | number | boolean) => h.append(key, String(v))); 
                                } else if (value !== undefined && value !== null) { 
                                    h.set(key, String(value)); 
                                } 
                            }); 
                        } 
                        return h; 
                    } 
                    const raw: Record<string, string> = {}; 
                    if (headers instanceof HttpHeaders) { 
                        headers.keys().forEach((key: string) => { 
                            const values = headers.getAll(key); 
                            if (values && values.length > 0) { 
                                raw[key] = values.join(', '); 
                            } else { 
                                const value = headers.get(key); 
                                if (value !== null) raw[key] = value; 
                            } 
                        }); 
                    } else if (headers) { 
                        Object.entries(headers as Record<string, string | number | boolean | object | undefined | null>).forEach(([key, value]) => { 
                            if (Array.isArray(value)) raw[key] = value.map((v: string | number | boolean) => String(v)).join(', '); 
                            else if (value !== undefined && value !== null) raw[key] = String(value); 
                        }); 
                    } 
                    return raw; 
                })(); 

                const fetchOptions: RequestInit = { method: '${model.httpMethod}', headers: fetchHeaders as HeadersInit }; 
                if (abortController) fetchOptions.signal = abortController.signal; 

                if (options?.withCredentials) fetchOptions.credentials = 'include'; 

                ${bodyArgument !== "null" ? `fetchOptions.body = ${bodyArgument} as Record<string, string | number | boolean | object | undefined | null>;` : ""} 

                fetch(url, fetchOptions).then(response => { 
                    if (!response.ok) { observer.error(response); return; } 

                    if (!response.body || !response.body.getReader) { 
                        observer.error(new Error('SSE response body is not readable in this environment.')); 
                        return; 
                    } 

                    const reader = response.body.getReader(); 
                    const decoder = new TextDecoder(); 
                    let buffer = ''; 
                    let isFirstLine = true; 
                    let dataLines: string[] = []; 
                    let eventName: string | undefined; 
                    let eventId: string | undefined; 
                    let lastEventId: string | undefined; 
                    let retry: number | undefined; 

                    const resetEvent = () => { 
                        dataLines = []; 
                        eventName = undefined; 
                        eventId = undefined; 
                        retry = undefined; 
                    }; 

                    const dispatch = () => { 
                        if (dataLines.length === 0) { 
                            resetEvent(); 
                            return; 
                        } 

                        const data = dataLines.join('${bs}n'); 
                        let payload: Record<string, string | number | boolean | object | undefined | null>; 
                        if ('${sseMode}' === 'event') { 
                            payload = { data }; 
                            const resolvedEvent = eventName ?? 'message'; 
                            if (resolvedEvent !== undefined) payload.event = resolvedEvent; 
                            const resolvedId = eventId !== undefined ? eventId : lastEventId; 
                            if (resolvedId !== undefined) payload.id = resolvedId; 
                            if (retry !== undefined) payload.retry = retry; 
                        } else { 
                            payload = data; 
                        } 

                        ${hasSseDecoding ? "payload = ContentDecoder.decode(payload, sseDecodingConfig);" : ""} 

                        observer.next(payload as Record<string, string | number | boolean | object | undefined | null>); 
                        resetEvent(); 
                    }; 

                    const processLine = (line: string) => { 
                        let currentLine = line; 
                        if (isFirstLine) { 
                            isFirstLine = false; 
                            if (currentLine.charCodeAt(0) === 0xfeff) { 
                                currentLine = currentLine.slice(1); 
                            } 
                        } 

                        if (currentLine === '') { dispatch(); return; } 

                        if (currentLine.startsWith(':')) return; 

                        const idx = currentLine.indexOf(':'); 

                        const field = idx === -1 ? currentLine : currentLine.slice(0, idx); 
                        let value = idx === -1 ? '' : currentLine.slice(idx + 1); 

                        if (value.startsWith(' ')) value = value.slice(1); 

                        switch (field) { 
                            case 'data': 
                                dataLines.push(value); 
                                break; 
                            case 'event': 
                                eventName = value; 
                                break; 
                            case 'id': 
                                if (!value.includes('${bs}u0000')) { 
                                    eventId = value; 
                                    lastEventId = value; 
                                } 
                                break; 
                            case 'retry': { 
                                const parsed = parseInt(value, 10); 
                                if (!Number.isNaN(parsed) && parsed >= 0) retry = parsed; 
                                break; 
                            } 
                            default: 
                                break; 
                        } 
                    }; 

                    const read = (): void => { 
                        reader.read().then(({ value, done }) => { 
                            if (done) { 
                                const tail = decoder.decode(); 
                                if (tail) buffer += tail; 
                                if (buffer.length > 0) { 
                                    const leftover = buffer.split(/${bs}r?${bs}n/); 
                                    buffer = ''; 
                                    leftover.forEach(processLine); 
                                } 
                                dispatch(); 

                                observer.complete(); 
                                return; 
                            } 
                            buffer += decoder.decode(value, { stream: true }); 
                            const lines = buffer.split(/${bs}r?${bs}n/); 
                            buffer = lines.pop() ?? ''; 
                            lines.forEach(processLine); 
                            read(); 
                        }).catch(error => observer.error(error)); 
                    }; 

                    read(); 
                }).catch(error => observer.error(error)); 

                return () => { 
                    if (abortController) abortController.abort(); 
                }; 
            });`);
}
