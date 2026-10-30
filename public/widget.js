"use strict";(()=>{function x(){return`
    :host {
      --rag-primary: #2563eb;
      --rag-primary-hover: #1d4ed8;
      --rag-bg: #ffffff;
      --rag-surface: #f8fafc;
      --rag-border: #e2e8f0;
      --rag-text-primary: #0f172a;
      --rag-text-secondary: #64748b;
      --rag-user-msg-bg: var(--rag-primary);
      --rag-user-msg-text: #ffffff;
      --rag-bot-msg-bg: #f1f5f9;
      --rag-bot-msg-text: #0f172a;
      --rag-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --rag-radius: 16px;
      --rag-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);

      font-family: var(--rag-font);
      font-size: 14px;
      line-height: 1.5;
      color: var(--rag-text-primary);
      box-sizing: border-box;
      z-index: 2147483647;
      position: fixed;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .rag-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--rag-primary);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.39);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;
      z-index: 2147483647;
    }

    .rag-launcher:hover {
      transform: scale(1.08);
      background: var(--rag-primary-hover);
    }

    .rag-launcher svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
      transition: transform 0.2s ease;
    }

    .rag-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: var(--rag-bg);
      border-radius: var(--rag-radius);
      box-shadow: var(--rag-shadow);
      border: 1px solid var(--rag-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.96);
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483647;
    }

    .rag-window.rag-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    /* Header */
    .rag-header {
      background: var(--rag-primary);
      color: #ffffff;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rag-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rag-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rag-header-title {
      font-weight: 600;
      font-size: 15px;
    }

    .rag-header-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      opacity: 0.85;
    }

    .rag-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
    }

    .rag-close-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      cursor: pointer;
      opacity: 0.8;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rag-close-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15);
    }

    /* Message Area */
    .rag-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--rag-surface);
    }

    .rag-messages::-webkit-scrollbar {
      width: 5px;
    }

    .rag-messages::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    .rag-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      word-break: break-word;
      font-size: 13.5px;
      line-height: 1.5;
    }

    .rag-msg-user {
      align-self: flex-end;
      background: var(--rag-user-msg-bg);
      color: var(--rag-user-msg-text);
      border-bottom-right-radius: 4px;
    }

    .rag-msg-bot {
      align-self: flex-start;
      background: var(--rag-bot-msg-bg);
      color: var(--rag-bot-msg-text);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--rag-border);
    }

    .rag-inline-code {
      background: rgba(0, 0, 0, 0.06);
      padding: 2px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
    }

    .rag-link {
      color: var(--rag-primary);
      text-decoration: underline;
      font-weight: 500;
    }

    /* Sources Pill */
    .rag-sources-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      padding: 3px 8px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 12px;
      margin-top: 6px;
      font-weight: 500;
    }

    /* Typing Pulse Indicator */
    .rag-typing-dots {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
    }

    .rag-typing-dot {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: rag-pulse 1.4s infinite ease-in-out both;
    }

    .rag-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .rag-typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes rag-pulse {
      0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Input Footer */
    .rag-footer {
      padding: 12px;
      background: var(--rag-bg);
      border-top: 1px solid var(--rag-border);
    }

    .rag-input-box {
      display: flex;
      align-items: center;
      background: var(--rag-surface);
      border: 1px solid var(--rag-border);
      border-radius: 24px;
      padding: 6px 8px 6px 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .rag-input-box:focus-within {
      border-color: var(--rag-primary);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    .rag-textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      resize: none;
      height: 22px;
      max-height: 80px;
      font-size: 13.5px;
      font-family: inherit;
      color: var(--rag-text-primary);
    }

    .rag-textarea::placeholder {
      color: var(--rag-text-secondary);
    }

    .rag-send-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--rag-primary);
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: opacity 0.2s ease, transform 0.1s ease;
    }

    .rag-send-btn:hover {
      background: var(--rag-primary-hover);
    }

    .rag-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rag-brand-tag {
      text-align: center;
      font-size: 10px;
      color: var(--rag-text-secondary);
      margin-top: 6px;
    }
  `}function f(s){return s?s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}function u(s){if(!s)return"";let e=f(s);return e=e.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/`([^`]+)`/g,'<code class="rag-inline-code">$1</code>'),e=e.replace(/\[([^\]]+)\]\(((?:[^()]+|\([^()]*\))*)\)/g,(t,r,o)=>{let i=o.trim();return/^(https?:\/\/|\/|mailto:)/i.test(i)?`<a href="${i}" target="_blank" rel="noopener noreferrer" class="rag-link">${r}</a>`:r}),e=e.replace(/\n/g,"<br />"),e}async function v(s){let{url:e,tenantKey:t,message:r,conversationId:o,onEvent:i,onError:n,onComplete:d,signal:p}=s;try{let a=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json","X-Tenant-Key":t},body:JSON.stringify({message:r,conversationId:o,tenantId:t}),signal:p});if(!a.ok){let l=await a.text();throw new Error(`HTTP ${a.status}: ${l||a.statusText}`)}if(!a.body)throw new Error("Response body is missing or streaming not supported");let y=a.body.getReader(),w=new TextDecoder("utf-8"),g="";for(;;){let{done:l,value:E}=await y.read();if(l)break;g+=w.decode(E,{stream:!0});let m=g.split(`
`);g=m.pop()||"";for(let S of m){let h=S.trim();if(!h||!h.startsWith("data:"))continue;let b=h.slice(5).trim();if(b)try{let C=JSON.parse(b);i(C)}catch{}}}if(g.trim().startsWith("data:"))try{let l=JSON.parse(g.trim().slice(5).trim());i(l)}catch{}d?.()}catch(a){if(p?.aborted)return;n?n(a instanceof Error?a:new Error(String(a))):console.error("[RAG Widget] Stream error:",a)}}var c=class{config;hostElement=null;shadowRoot=null;conversationId;isOpen=!1;isGenerating=!1;constructor(e){this.config={tenantKey:e.tenantKey||"default_tenant",apiBase:e.apiBase||"",primaryColor:e.primaryColor||"#2563eb",position:e.position||"bottom-right",greeting:e.greeting||"Hi! How can I assist you with our products today?",title:e.title||"Support Assistant"};let t=`rag_conv_${this.config.tenantKey}`,r=typeof window<"u"?window.sessionStorage?.getItem(t):null;this.conversationId=r||`conv_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,typeof window<"u"&&window.sessionStorage&&window.sessionStorage.setItem(t,this.conversationId)}init(){if(typeof document>"u"||this.hostElement)return;this.hostElement=document.createElement("div"),this.hostElement.id="db-native-rag-widget-root",this.shadowRoot=this.hostElement.attachShadow({mode:"open"});let e=document.createElement("style");e.textContent=x(),this.shadowRoot.appendChild(e),this.config.primaryColor&&this.hostElement.style.setProperty("--rag-primary",this.config.primaryColor);let t=document.createElement("div");t.innerHTML=`
      <button class="rag-launcher" aria-label="Open chat widget">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>

      <div class="rag-window" role="dialog" aria-modal="true" aria-label="Chat window">
        <div class="rag-header">
          <div class="rag-header-left">
            <div class="rag-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
            </div>
            <div>
              <div class="rag-header-title">${f(this.config.title)}</div>
              <div class="rag-header-status"><span class="rag-status-dot"></span> Live verified database</div>
            </div>
          </div>
          <button class="rag-close-btn" aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div class="rag-messages" id="rag-msg-list"></div>

        <div class="rag-footer">
          <div class="rag-input-box">
            <textarea class="rag-textarea" placeholder="Ask a question..." rows="1"></textarea>
            <button class="rag-send-btn" aria-label="Send inquiry">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          <div class="rag-brand-tag">Powered by DB-Native RAG</div>
        </div>
      </div>
    `,this.shadowRoot.appendChild(t),document.body.appendChild(this.hostElement),this.bindEvents(),this.addBotMessage(this.config.greeting)}bindEvents(){if(!this.shadowRoot)return;let e=this.shadowRoot.querySelector(".rag-launcher"),t=this.shadowRoot.querySelector(".rag-close-btn"),r=this.shadowRoot.querySelector(".rag-send-btn"),o=this.shadowRoot.querySelector(".rag-textarea");e?.addEventListener("click",()=>this.toggle()),t?.addEventListener("click",()=>this.toggle(!1)),r?.addEventListener("click",()=>this.handleSend()),o?.addEventListener("keydown",i=>{i.key==="Enter"&&!i.shiftKey&&(i.preventDefault(),this.handleSend())})}toggle(e){if(!this.shadowRoot)return;let t=this.shadowRoot.querySelector(".rag-window");if(this.isOpen=typeof e=="boolean"?e:!this.isOpen,this.isOpen){t?.classList.add("rag-open");let r=this.shadowRoot.querySelector(".rag-textarea");setTimeout(()=>r?.focus(),150)}else t?.classList.remove("rag-open")}async handleSend(){if(!this.shadowRoot||this.isGenerating)return;let e=this.shadowRoot.querySelector(".rag-textarea"),t=this.shadowRoot.querySelector(".rag-send-btn"),r=e?.value?.trim();if(!r)return;e.value="",this.addUserMessage(r);let o=this.createBotMessagePlaceholder();this.isGenerating=!0,t.disabled=!0;let i="",n=0,d=[],p=`${this.config.apiBase}/api/v1/chat/message`;await v({url:p,tenantKey:this.config.tenantKey,message:r,conversationId:this.conversationId,onEvent:a=>{a.event==="sources"?(n=a.count,d=a.tables||[]):a.event==="token"?(i+=a.delta,this.updateBotMessageContent(o,i,!1)):a.event==="done"?this.updateBotMessageContent(o,i,!0,n,d):a.event==="error"&&this.updateBotMessageContent(o,`Error: ${a.message}`,!0)},onError:a=>{this.updateBotMessageContent(o,"Sorry, unable to connect to the knowledge assistant. Please try again.",!0)},onComplete:()=>{this.isGenerating=!1,t.disabled=!1,e.focus()}})}addUserMessage(e){if(!this.shadowRoot)return;let t=this.shadowRoot.querySelector("#rag-msg-list"),r=document.createElement("div");r.className="rag-msg rag-msg-user",r.textContent=e,t?.appendChild(r),this.scrollToBottom()}addBotMessage(e){if(!this.shadowRoot)return;let t=this.shadowRoot.querySelector("#rag-msg-list"),r=document.createElement("div");r.className="rag-msg rag-msg-bot",r.innerHTML=u(e),t?.appendChild(r),this.scrollToBottom()}createBotMessagePlaceholder(){let e=this.shadowRoot?.querySelector("#rag-msg-list"),t=document.createElement("div");return t.className="rag-msg rag-msg-bot",t.innerHTML=`
      <div class="rag-typing-dots">
        <span class="rag-typing-dot"></span>
        <span class="rag-typing-dot"></span>
        <span class="rag-typing-dot"></span>
      </div>
    `,e?.appendChild(t),this.scrollToBottom(),t}updateBotMessageContent(e,t,r,o=0,i=[]){let n=u(t);if(r&&o>0){let d=i.length>0?` (${i.join(", ")})`:"";n+=`
        <div>
          <span class="rag-sources-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Verified from ${o} record${o>1?"s":""}${d}
          </span>
        </div>
      `}e.innerHTML=n,this.scrollToBottom()}scrollToBottom(){if(!this.shadowRoot)return;let e=this.shadowRoot.querySelector("#rag-msg-list");e&&(e.scrollTop=e.scrollHeight)}destroy(){this.hostElement&&this.hostElement.parentNode&&(this.hostElement.parentNode.removeChild(this.hostElement),this.hostElement=null,this.shadowRoot=null)}};function k(){if(typeof window>"u"||typeof document>"u")return;let s=document.currentScript||document.querySelector("script[data-tenant-key]")||document.querySelector('script[src*="widget.js"]'),e={tenantKey:s?.getAttribute("data-tenant-key")||"default_tenant",apiBase:s?.getAttribute("data-api-base")||"",primaryColor:s?.getAttribute("data-primary-color")||void 0,position:s?.getAttribute("data-position")||void 0,greeting:s?.getAttribute("data-greeting")||void 0,title:s?.getAttribute("data-title")||void 0},t=new c(e);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>t.init()):t.init(),window.RagWidget={instance:t,init:r=>{let o=new c(r);return o.init(),o},open:()=>t.toggle(!0),close:()=>t.toggle(!1),toggle:()=>t.toggle()}}k();})();
