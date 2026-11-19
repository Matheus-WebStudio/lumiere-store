(function portfolioApp() {
  'use strict';
  const C=window.SITE_CONFIG;
  const M=window.PortfolioModel;
  const store=M.create(C,localStorage);
  const main=document.querySelector('main');
  const dialog=document.querySelector('dialog');
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const values=form=>Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,typeof value==='string'?value.trim():value]));
  const options=(list,selected)=>list.map(value=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(value)}</option>`).join('');
  const input=(name,label,value='',attrs='')=>`<label>${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
  const textarea=(name,label,value='',attrs='')=>`<label>${label}<textarea name="${name}" ${attrs}>${esc(value)}</textarea></label>`;
  const select=(name,label,list,selected='',blank='')=>`<label>${label}<select name="${name}">${blank?`<option value="">${blank}</option>`:''}${options(list,selected)}</select></label>`;
  const empty=(title,text)=>`<div class="empty"><h3>${title}</h3><p>${text}</p></div>`;
  const button=(text,action,extra='')=>`<button type="button" data-action="${action}" ${extra}>${text}</button>`;
  const image=(photo,eager=false)=>photo&&M.imageURL(photo.src)?`<img src="${esc(M.imageURL(photo.src))}" alt="${esc(photo.alt)}" ${eager?'fetchpriority="high"':'loading="lazy"'}>`:'<div class="image-empty">Imagem indisponível</div>';
  const price=item=>item.price?money(item.price)+(C.mode==='hotel'?' / noite':C.slug==='titan-fitness'&&item.category==='Planos'?' / mês':''):(['briefing','quote'].includes(C.mode)?'Projeto sob consulta':C.mode==='appointment'?'Experiência demonstrativa':'Consulte os detalhes');
  let db,filters={},tab='items',editing=null,basket=[],favorites=[];
  try { basket=JSON.parse(sessionStorage.getItem(C.slug+'-basket')||'[]'); favorites=JSON.parse(localStorage.getItem(C.slug+'-favorites')||'[]'); if(!Array.isArray(basket)||!Array.isArray(favorites))throw Error(); }
  catch { basket=[];favorites=[]; }
  function read() {
    try {db=store.read();document.getElementById('storage-error').hidden=true;}
    catch(error) {db=M.clone(store.seed);document.getElementById('storage-error').hidden=false;document.getElementById('storage-error').textContent=error.message;}
  }
  function status(form,text,error=false) {
    const node=form.querySelector('.feedback');
    node.textContent=text;
    node.className='feedback '+(error?'error':'success');
  }
  function persist(form,action,message,done) {
    try {action();read();status(form,message);done?.();return true;}
    catch(error){status(form,error.name==='QuotaExceededError'?'Armazenamento cheio. Reduza as imagens e tente novamente.':error.message,true);return false;}
  }
  function open(title,body) {
    dialog.innerHTML=`<button type="button" class="close" aria-label="Fechar" autofocus>×</button><div class="dialog-content"><h2 id="dialog-title">${esc(title)}</h2>${body}</div>`;
    dialog.querySelector('.close').onclick=()=>dialog.close();
    if(!dialog.open)dialog.showModal();
  }
  function photoError(event) {
    if(event.target.tagName!=='IMG')return;
    event.target.outerHTML='<div class="image-empty">Imagem indisponível</div>';
  }
  main.addEventListener('error',photoError,true);
  dialog.addEventListener('error',photoError,true);
  function rememberBasket(){sessionStorage.setItem(C.slug+'-basket',JSON.stringify(basket));}
  function favorite(id) {
    const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
    try{localStorage.setItem(C.slug+'-favorites',JSON.stringify(next));favorites=next;}
    catch {open('Armazenamento indisponível','<p>Não foi possível salvar seus favoritos neste navegador.</p>');return;}
    renderResults();
  }
  function card(item) {
    return `<article class="card"><a class="card-photo" href="#detalhe/${encodeURIComponent(item.id)}" tabindex="-1" aria-hidden="true">${image(item.images[0])}</a><div class="card-body"><p class="eyebrow">${esc(item.category)}</p>
      <h3><a href="#detalhe/${encodeURIComponent(item.id)}">${esc(item.title)}</a></h3><p>${esc(item.description)}</p>
      <div class="card-bottom"><span>${esc(price(item))}</span><span class="tag">${item.available?'Disponível':'Indisponível'}</span></div>
      <div class="card-actions"><a class="text-link" href="#detalhe/${encodeURIComponent(item.id)}">Ver detalhes <span aria-hidden="true">↗</span></a>${C.mode==='shop'?button(favorites.includes(item.id)?'♥ Salvo':'♡ Salvar','favorite',`data-id="${esc(item.id)}" aria-pressed="${favorites.includes(item.id)}" aria-label="Salvar ${esc(item.title)} nos favoritos"`):''}</div></div></article>`;
  }
  function renderResults() {
    let items;
    try {items=store.search(filters);} catch {items=db.items.filter(i=>i.published);}
    if(filters.favorites)items=items.filter(i=>favorites.includes(i.id));
    const sort=document.querySelector('[name=sort]')?.value;
    if(sort==='Menor preço')items.sort((a,b)=>a.price-b.price);
    if(sort==='Maior preço')items.sort((a,b)=>b.price-a.price);
    document.getElementById('result-count').textContent=`${items.length} ${items.length===1?'resultado':'resultados'}`;
    const results=document.getElementById('results');
    results.innerHTML=items.length?items.map(card).join(''):empty('Nenhum resultado','Mude os filtros ou limpe a busca para explorar outras opções.');
    results.querySelectorAll('[data-action=favorite]').forEach(btn=>btn.onclick=()=>favorite(btn.dataset.id));
  }
  function home() {
    const c=db.content,s=db.settings;
    const wa=M.whatsappURL(s.whatsapp,`Olá! Vim pelo site ${C.name} e gostaria de mais informações.`);
    main.innerHTML=`<section class="hero" id="inicio"><div class="hero-copy"><p class="eyebrow">${esc(C.tag)}</p><h1>${esc(c.title)}</h1><p>${esc(c.intro)}</p><div class="hero-actions"><a class="button primary" href="#catalogo">${C.mode==='shop'?'Explorar coleção':C.mode==='hotel'?'Encontrar meu refúgio':'Explorar '+(C.slug==='casa-oliva'?'cardápio':C.slug==='prime-auto'?'veículos':C.slug==='next-academy'?'cursos':C.mode==='briefing'?'projetos':'possibilidades')} <span aria-hidden="true">↗</span></a>${C.mode==='table'?'<button class="button outline" id="reserve">Reservar mesa</button>':''}</div></div><div class="hero-photo">${image({src:'assets/hero.jpg',alt:'Imagem ilustrativa de '+C.sector.toLowerCase()},true)}<span>PROJETO DEMONSTRATIVO</span></div></section>
      <div class="value-strip">${C.features.map(feature=>`<span>${esc(feature)}</span>`).join('')}</div>
      <section class="section" id="catalogo"><div class="section-head"><div><p class="eyebrow">${esc(C.sector)}</p><h2>${esc(C.catalog)}</h2></div>${C.mode==='shop'?'<button class="button outline" id="basket-open">Ver sacola ('+basket.reduce((sum,row)=>sum+row.quantity,0)+')</button>':''}</div>
      <form id="filters" class="filters" role="search" aria-label="Filtrar catálogo">${input('q','Buscar','','type="search" placeholder="Nome, categoria ou característica"')}${select('category','Categoria',[...new Set(db.items.filter(i=>i.published).map(i=>i.category))],'','Todas')}${input('max','Valor máximo (R$)','','type="number" min="0" step="0.01" placeholder="Sem limite"')}${select('sort','Ordenar',['Seleção','Menor preço','Maior preço'],'Seleção')}<label class="checkbox"><input type="checkbox" name="available"> Apenas disponíveis</label>${C.mode==='shop'?'<label class="checkbox"><input type="checkbox" name="favorites"> Meus favoritos</label>':''}<button class="button primary">Buscar</button></form>
      <div class="results-bar"><p id="result-count" role="status"></p><button type="reset" form="filters" class="text-link">Limpar filtros</button></div><div class="cards" id="results"></div></section>
      <section class="about section" id="sobre"><p class="eyebrow">Sobre ${esc(C.name)}</p><h2>${esc(c.aboutTitle)}</h2><div><p>${esc(c.about)}</p><p class="muted">Marca fictícia · Conteúdo e imagens ilustrativos.</p></div></section>
      <section class="section contact" id="contato"><div><p class="eyebrow">Vamos conversar</p><h2>Seu próximo passo<br>começa por aqui.</h2><p>${esc(s.city)}<br>${esc(s.hours)}<br>${esc(s.email)}${s.phone?'<br>'+esc(s.phone):''}</p>${wa?`<a class="button primary" href="${esc(wa)}">Conversar no WhatsApp ↗</a>`:'<button class="button primary" id="whatsapp-demo">Conversar no WhatsApp ↗</button>'}</div>
      <form id="contact-form" class="form-box"><p class="notice">Contato demonstrativo. Use dados fictícios. Mensagens ficam neste navegador.</p><div class="fields">${input('name','Nome','','required maxlength="100" autocomplete="name"')}${input('email','E-mail','','required type="email" maxlength="150" autocomplete="email"')}</div>${textarea('message','Mensagem','','required rows="4" maxlength="2000"')}<button class="button primary">Registrar mensagem</button><p class="feedback" role="status"></p></form></section>`;
    const form=document.getElementById('filters');
    for(const [key,value]of Object.entries(filters)){if(form.elements[key]){if(form.elements[key].type==='checkbox')form.elements[key].checked=!!value;else form.elements[key].value=value;}}
    form.onsubmit=event=>{event.preventDefault();filters=values(form);renderResults();};
    form.onreset=()=>{filters={};queueMicrotask(renderResults);};
    renderResults();
    document.getElementById('reserve')?.addEventListener('click',()=>requestForm(db.items.find(i=>i.published&&i.available)));
    document.getElementById('basket-open')?.addEventListener('click',cart);
    document.getElementById('whatsapp-demo')?.addEventListener('click',()=>open('WhatsApp demonstrativo','<p>Configure um número autorizado em Painel → Configurações para abrir uma conversa pelo WhatsApp.</p>'));
    document.getElementById('contact-form').onsubmit=event=>{
      event.preventDefault();const f=event.currentTarget,fields=values(f);
      persist(f,()=>store.update(data=>{
        if(!fields.name||!fields.message)throw Error('Preencha nome e mensagem.');
        data.messages.unshift({...fields,id:M.id(),read:false,created:new Date().toISOString()});
      }),'Mensagem registrada neste navegador.',()=>f.reset());
    };
  }
  function detail(itemId) {
    const item=db.items.find(i=>i.id===itemId&&i.published);
    if(!item){main.innerHTML=`<section class="section">${empty('Opção não encontrada','O conteúdo pode ter sido retirado do catálogo.')}<a class="button primary" href="#catalogo">Voltar ao catálogo</a></section>`;return;}
    document.title=item.title+' | '+C.name;
    document.querySelector('meta[name=description]').content=item.description;
    main.innerHTML=`<section class="section detail"><a class="text-link" href="#catalogo">← Voltar ao catálogo</a><div class="section-head"><div><p class="eyebrow">${esc(item.category)}</p><h1>${esc(item.title)}</h1></div><span class="tag">${item.available?'Disponível':'Indisponível'}</span></div>
      <div class="detail-grid"><div><div id="large-photo" class="large-photo"></div><div class="thumbs">${item.images.map((photo,index)=>`<button type="button" data-photo="${index}" aria-label="Foto ${index+1}: ${esc(photo.alt)}" aria-pressed="${index===0}">${image(photo)}</button>`).join('')}</div></div><div class="detail-copy"><p class="detail-price">${esc(price(item))}</p><p>${esc(item.description)}</p><dl>${C.fields.map(([key,label])=>`<div><dt>${esc(label.replace(' (separados por vírgula)',''))}</dt><dd>${esc(item[key])}</dd></div>`).join('')}</dl>
      ${C.mode==='shop'?select('variant','Tamanho',String(item.variants).split(',').map(v=>v.trim()))+input('quantity','Quantidade',1,'type="number" min="1" max="99" step="1"')+'<p id="stock-label" role="status"></p>':''}
      <button id="request" class="button primary" ${!item.available||!db.settings.open?'disabled':''}>${esc(C.action)} ↗</button><p class="notice">${!item.available?'Esta opção está indisponível.':!db.settings.open?'Solicitações temporariamente pausadas.':C.mode==='shop'?'Pedido demonstrativo, sem cobrança ou envio.':'Solicitação demonstrativa sujeita a confirmação no painel.'}</p></div></div></section>`;
    let index=0;
    function gallery(){
      document.getElementById('large-photo').innerHTML=item.images[index]?`<button type="button" aria-label="Ampliar foto ${index+1}">${image(item.images[index],true)}</button>`:image();
      main.querySelectorAll('[data-photo]').forEach(btn=>btn.setAttribute('aria-pressed',Number(btn.dataset.photo)===index));
      main.querySelector('#large-photo button')?.addEventListener('click',()=>open(item.title,`<div class="lightbox">${image(item.images[index],true)}</div><p>${esc(item.images[index].alt)}</p>`));
    }
    main.querySelectorAll('[data-photo]').forEach(btn=>btn.onclick=()=>{index=Number(btn.dataset.photo);gallery();});gallery();
    document.getElementById('request').onclick=()=>{
      if(C.mode!=='shop')return requestForm(item);
      const variant=main.querySelector('[name=variant]').value,quantity=Number(main.querySelector('[name=quantity]').value);
      const current=db.items.find(i=>i.id===item.id);
      const held=basket.find(row=>row.itemId===item.id&&row.variant===variant);
      if(!Number.isInteger(quantity)||quantity<1||quantity+(held?.quantity||0)>(current.variantStock?.[variant]??current.stock)){open('Confira a quantidade','<p>A quantidade ultrapassa o estoque disponível para esse tamanho.</p>');return;}
      const next=M.clone(basket);
      const row=next.find(r=>r.itemId===item.id&&r.variant===variant);
      if(row)row.quantity+=quantity;else next.push({itemId:item.id,variant,quantity});
      try{sessionStorage.setItem(C.slug+'-basket',JSON.stringify(next));basket=next;cart();}catch{open('Armazenamento indisponível','<p>Não foi possível salvar a sacola neste navegador.</p>');}
    };
    if(C.mode==='shop'){
      const variant=main.querySelector('[name=variant]');
      const stock=()=>{document.getElementById('stock-label').textContent=`${item.variantStock?.[variant.value]??item.stock} unidades neste tamanho`;};variant.onchange=stock;stock();
    }
  }
  function requestForm(item,checkout=false) {
    if(!item&&!checkout){open('Sem opções disponíveis','<p>Explore novamente o catálogo mais tarde.</p>');return;}
    const mode=C.mode;
    const times=mode==='table'?['12:00','14:00','19:00','21:00']:['09:00','11:00','14:00','16:00','18:00'];
    open(checkout?'Finalizar pedido demonstrativo':C.action,`<p class="notice">Use dados fictícios. Nenhum pagamento é realizado. Sua solicitação ficará neste navegador.</p>
      <form id="request-form" class="form-box">${!checkout?`<p class="selected-item">${esc(item.title)}</p>`:''}<div class="fields">${input('name','Nome','','required maxlength="100" autocomplete="name"')}${input('email','E-mail','','required type="email" maxlength="150" autocomplete="email"')}${input('phone','Telefone (opcional)','','type="tel" maxlength="35" autocomplete="tel"')}
      ${C.date?input('date',mode==='hotel'?'Entrada':'Data desejada','','type="date" min="'+M.today()+'" required'):''}
      ${mode==='hotel'?input('endDate','Saída','','type="date" min="'+M.today()+'" required'):''}
      ${C.time?select('time','Horário',times,'','Selecione'):''}
      ${C.people||mode==='hotel'?input('people',mode==='hotel'?'Hóspedes':mode==='table'?'Pessoas':'Participantes',1,'required type="number" min="1" max="5000" step="1"'):''}
      ${(C.extra||[]).map(([key,label,type,required])=>input(key,label,'',`${required?'required ':''}type="${type}" ${type==='number'?'min="1" max="999999"':'maxlength="160"'}`)).join('')}
      </div>${textarea('note',mode==='briefing'?'Conte sua ideia':'Observações (opcional)','','rows="3" maxlength="2000"')}<button class="button primary">${checkout?'Registrar pedido':'Registrar solicitação'}</button><p class="feedback" role="status"></p></form>`);
    const form=dialog.querySelector('form');
    form.onsubmit=event=>{
      event.preventDefault();
      const fields={...values(form),itemId:item?.id};
      const ok=persist(form,()=>store.submitRequest(fields,checkout?basket:[]),'Solicitação registrada.');
      if(!ok)return;
      if(checkout){basket=[];try{rememberBasket();}catch{}}
      const request=db.requests[0];
      open('Solicitação registrada',`<p>Seu protocolo demonstrativo é <strong>${esc(request.id.slice(0,8))}</strong>.</p><p>Você pode acompanhar o status no painel deste navegador.</p>${request.total?'<p>Total demonstrativo <strong>'+money(request.total)+'</strong></p>':''}`);
    };
  }
  function cart(){
    read();
    open('Sua sacola',basket.length?`<div class="basket-list">${basket.map((row,index)=>{
      const item=db.items.find(i=>i.id===row.itemId);
      return `<div class="basket-row"><div><h3>${esc(item?.title||'Produto removido')}</h3><p>Tamanho ${esc(row.variant)} · ${row.quantity} unidades</p><p>${item?money(item.price*row.quantity):'Indisponível'}</p></div>${button('Remover','remove',`data-index="${index}"`)}</div>`;
    }).join('')}</div><p class="cart-total">Total ${money(basket.reduce((sum,row)=>sum+(db.items.find(i=>i.id===row.itemId)?.price||0)*row.quantity,0))}</p><button class="button primary" id="checkout">Continuar pedido</button>`:empty('Sua sacola está vazia','Explore a coleção e adicione suas peças favoritas.'));
    dialog.querySelectorAll('[data-action=remove]').forEach(btn=>btn.onclick=()=>{const next=basket.filter((_,i)=>i!==Number(btn.dataset.index));try{sessionStorage.setItem(C.slug+'-basket',JSON.stringify(next));basket=next;cart();}catch{open('Armazenamento indisponível','<p>Não foi possível atualizar a sacola.</p>');}});
    dialog.querySelector('#checkout')?.addEventListener('click',()=>requestForm(null,true));
  }
    const adminTabs=[['items',C.mode==='shop'?'Produtos':C.mode==='hotel'?'Acomodações':C.mode==='table'?'Cardápio':C.mode==='enrollment'?'Cursos':C.mode==='briefing'?'Projetos':'Catálogo'],['requests',C.mode==='shop'?'Pedidos':C.mode==='hotel'||C.mode==='table'?'Reservas':C.mode==='enrollment'?'Matrículas':'Solicitações'],['messages','Mensagens'],['content','Conteúdo'],['settings','Configurações']];
  function admin(feedback=''){
    main.innerHTML=`<section class="section admin"><a class="text-link" href="#inicio">← Voltar ao site</a><div class="section-head"><div><p class="eyebrow">Gerenciamento</p><h1>Painel ${esc(C.name)}</h1></div></div>
      <p class="notice">Demonstração aberta, sem autenticação. Dados salvos somente neste navegador. Use informações fictícias.</p>
      <div class="metrics"><div><strong>${db.items.length}</strong> cadastros</div><div><strong>${db.requests.filter(r=>r.status==='Nova').length}</strong> novas solicitações</div><div><strong>${db.messages.filter(m=>!m.read).length}</strong> mensagens novas</div></div>
      <nav class="admin-tabs" aria-label="Áreas do painel">${adminTabs.map(([key,label])=>`<button type="button" data-tab="${key}" ${tab===key?'aria-current="true"':''}>${esc(label)}</button>`).join('')}</nav><p id="admin-feedback" class="feedback" role="status">${esc(feedback)}</p><div id="admin-view"></div></section>`;
    main.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.tab;editing=null;admin();main.querySelector('[aria-current]').focus();});
    const view=document.getElementById('admin-view');
    if(tab==='items')itemsAdmin(view);
    else if(tab==='requests')requestsAdmin(view);
    else if(tab==='messages')messagesAdmin(view);
    else settingsAdmin(view);
  }
  function refresh(message){read();admin(message);main.querySelector('[aria-current]')?.focus();}
  function confirmAction(title,text,action){
    open(title,`<p>${text}</p><form><button class="button primary">Confirmar</button><p class="feedback" role="status"></p></form>`);
    dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(persist(event.currentTarget,action,'Concluído.')){dialog.close();refresh('Alteração concluída.');}};
  }
  function itemsAdmin(view){
    if(editing!==null){editItem(view,db.items.find(item=>item.id===editing));return;}
    view.innerHTML=`<div class="section-head compact"><h2>${esc(adminTabs[0][1])}</h2><button id="new-item" class="button primary">Adicionar ${esc(C.item.toLowerCase())}</button></div>
      ${db.items.length?`<div class="admin-list">${db.items.map(item=>`<article class="admin-row"><div class="admin-photo">${image(item.images[0])}</div><div><h3>${esc(item.title)}</h3><p>${esc(item.category)} · ${esc(price(item))}</p><span class="tag">${item.published?'Publicado':'Rascunho'}</span> <span class="tag">${item.available?'Disponível':'Indisponível'}</span></div><div class="row-actions">${button('Editar','edit',`data-id="${esc(item.id)}" aria-label="Editar ${esc(item.title)}"`)}${button('Excluir','delete',`data-id="${esc(item.id)}" aria-label="Excluir ${esc(item.title)}"`)}</div></article>`).join('')}</div>`:empty('Nenhum cadastro','Adicione uma opção para começar.')}`;
    document.getElementById('new-item').onclick=()=>{editing='';admin();main.querySelector('[name=title]').focus();};
    view.querySelectorAll('[data-action=edit]').forEach(btn=>btn.onclick=()=>{editing=btn.dataset.id;admin();main.querySelector('[name=title]').focus();});
    view.querySelectorAll('[data-action=delete]').forEach(btn=>btn.onclick=()=>confirmAction('Excluir cadastro?','As solicitações anteriores ficarão no histórico.',()=>store.update(data=>{
      if(data.requests.some(r=>r.itemId===btn.dataset.id&&M.active(r)))throw Error('Existem solicitações ativas para este cadastro. Conclua ou cancele antes de excluir.');
      if(data.requests.some(r=>r.lines?.some(line=>line.itemId===btn.dataset.id)&&M.active(r)))throw Error('Existem pedidos ativos deste produto. Conclua ou cancele antes de excluir.');
      data.items=data.items.filter(item=>item.id!==btn.dataset.id);
    })));
  }
  function editItem(view,item){
    const current=item||{price:0,available:true,published:false,images:[],...Object.fromEntries(C.fields.map(([key,,type])=>[key,type==='number'?1:'']))};
    const fields=C.fields.map(([key,label,type])=>type==='textarea'?textarea(key,label,current[key],'rows="3" required maxlength="2000"'):input(key,label,current[key],type==='number'?'type="number" min="0" step="1" max="9999999" required':'required maxlength="300"'));
    view.innerHTML=`<div class="section-head compact"><h2>${item?'Editar':'Novo cadastro'}</h2><button id="cancel-edit" class="text-link">Voltar à lista</button></div>
      <form id="item-form" class="form-box"><div class="fields">${input('title','Nome',current.title,'required maxlength="100"')}${input('category','Categoria',current.category,'required maxlength="70"')}${input('price','Valor (R$)',current.price,'type="number" min="0" step="0.01" max="999999999" required')}${fields.join('')}</div>
      ${textarea('description','Descrição',current.description,'required rows="4" maxlength="3000"')}
      <label class="checkbox"><input name="published" type="checkbox" ${current.published?'checked':''}> Exibir no site</label><label class="checkbox"><input name="available" type="checkbox" ${current.available?'checked':''}> Disponível para solicitações</label>
      ${C.mode==='shop'&&item?'<p class="notice">Ao alterar o estoque base, o novo valor será aplicado a todos os tamanhos. Pedidos já registrados ficam no histórico.</p>':''}
      <fieldset><legend>Galeria de imagens</legend><p>Até 8 imagens. URLs HTTPS ou arquivos JPEG, PNG e WebP de até 500 KB. A primeira foto é a capa.</p><div id="photo-editor"></div><div class="image-actions"><button type="button" id="add-photo">Adicionar endereço de imagem</button><label>Enviar imagem<input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label></div><p id="photo-feedback" role="status"></p></fieldset>
      <button class="button primary">Salvar cadastro</button><p class="feedback" role="status"></p></form>`;
    const photos=M.clone(current.images),list=document.getElementById('photo-editor');
    document.getElementById('cancel-edit').onclick=()=>{editing=null;admin();};
    function renderPhotos(){
      list.innerHTML=photos.length?photos.map((photo,index)=>`<div class="photo-editor-row"><div class="admin-photo">${image(photo)}</div><div>${photo.src.startsWith('data:')?'<p>Arquivo enviado</p>':input('photo-url-'+index,'Endereço da imagem '+(index+1),photo.src,`data-url="${index}" required ${photo.src.startsWith('assets/')?'readonly':''}`)}${input('photo-alt-'+index,'Descrição da imagem '+(index+1),photo.alt,`data-alt="${index}" required maxlength="180"`)}</div><div class="row-actions">${index?button('Subir','up',`data-index="${index}" aria-label="Mover imagem ${index+1} para cima"`):'<span class="tag">Capa</span>'}${button('Remover','remove',`data-index="${index}" aria-label="Remover imagem ${index+1}"`)}</div></div>`).join(''):'<p>Nenhuma imagem cadastrada.</p>';
    }
    list.oninput=event=>{if('url'in event.target.dataset)photos[event.target.dataset.url].src=event.target.value.trim();if('alt'in event.target.dataset)photos[event.target.dataset.alt].alt=event.target.value.trim();};
    list.onclick=event=>{
      const btn=event.target.closest('button');if(!btn)return;
      const index=Number(btn.dataset.index);
      if(btn.dataset.action==='up'){[photos[index-1],photos[index]]=[photos[index],photos[index-1]];}
      if(btn.dataset.action==='remove')photos.splice(index,1);
      renderPhotos();document.getElementById('add-photo').focus();
    };
    function add(photo){if(photos.length>=8){document.getElementById('photo-feedback').textContent='Limite de 8 imagens.';return;}photos.push(photo);renderPhotos();list.querySelectorAll('[data-alt]')[photos.length-1]?.focus();}
    document.getElementById('add-photo').onclick=()=>add({src:'',alt:''});
    document.getElementById('photo-file').onchange=event=>{
      const file=event.target.files[0];event.target.value='';if(!file)return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>500*1024){document.getElementById('photo-feedback').textContent='Escolha JPEG, PNG ou WebP de até 500 KB.';return;}
      const reader=new FileReader();reader.onload=()=>add({src:reader.result,alt:''});reader.onerror=()=>{document.getElementById('photo-feedback').textContent='Falha ao ler a imagem.';};reader.readAsDataURL(file);
    };
    renderPhotos();
    view.querySelector('form').onsubmit=event=>{
      event.preventDefault();const form=event.currentTarget,raw=values(form);
      const row={id:item?.id||M.id(),title:raw.title,category:raw.category,price:Number(raw.price),description:raw.description,published:!!raw.published,available:!!raw.available,images:photos};
      for(const[key,,type]of C.fields)row[key]=type==='number'?Number(raw[key]):raw[key];
      if(C.mode==='shop'&&item&&row.stock===item.stock)row.variantStock=item.variantStock;
      if(persist(form,()=>store.update(data=>{
        store.validateItem(row);
        if(item){const index=data.items.findIndex(i=>i.id===item.id);if(index<0)throw Error('O cadastro foi excluído em outra aba.');data.items[index]=row;}else data.items.unshift(row);
      }),'Cadastro salvo.')){editing=null;refresh('Cadastro salvo e integrado ao site.');}
    };
  }
  function requestsAdmin(view){
    view.innerHTML=`<div class="section-head compact"><h2>${esc(adminTabs[1][1])}</h2>${select('status-filter','Filtrar status',M.statuses,'','Todos')}</div><div id="request-list"></div>`;
    const filter=view.querySelector('select'),list=document.getElementById('request-list');
    function render(){
      const rows=db.requests.filter(r=>!filter.value||r.status===filter.value);
      list.innerHTML=rows.length?rows.map(r=>`<article class="inbox"><div><p class="eyebrow">Protocolo ${esc(r.id.slice(0,8))}</p><h3>${esc(r.itemTitle||'Pedido demonstrativo')}</h3><p><strong>${esc(r.name)}</strong> · ${esc(r.email)}${r.phone?' · '+esc(r.phone):''}</p>
        ${r.date?'<p>'+esc(r.date.split('-').reverse().join('/'))+(r.endDate?' até '+esc(r.endDate.split('-').reverse().join('/')):'')+(r.time?' às '+esc(r.time):'')+'</p>':''}
        ${r.people?'<p>'+r.people+' participante(s) / hóspede(s)</p>':''}
        ${(C.extra||[]).filter(([key])=>r[key]).map(([key,label])=>'<p>'+esc(label)+': '+esc(r[key])+'</p>').join('')}
        ${r.lines?`<ul>${r.lines.map(line=>`<li>${esc(line.title)} · ${esc(line.variant)} · ${line.quantity} × ${money(line.price)}</li>`).join('')}</ul>`:''}
        ${r.total?'<p>Total demonstrativo <strong>'+money(r.total)+'</strong></p>':''}${r.note?'<p class="preserve">'+esc(r.note)+'</p>':''}</div>
        <form data-id="${esc(r.id)}">${select('status','Status',M.statuses,r.status)}<button class="button outline">Salvar status</button><p class="feedback" role="status"></p></form></article>`).join(''):empty('Nenhuma solicitação','As solicitações feitas no site aparecem aqui.');
      list.querySelectorAll('form').forEach(form=>form.onsubmit=event=>{event.preventDefault();if(persist(form,()=>store.changeStatus(form.dataset.id,form.elements.status.value),'Status atualizado.'))refresh('Status atualizado.');});
    }
    filter.onchange=render;render();
  }
  function messagesAdmin(view){
    view.innerHTML=`<h2>Mensagens</h2>${db.messages.length?db.messages.map(message=>`<article class="inbox"><div><h3>${esc(message.name)}</h3><p>${esc(message.email)}</p><p class="preserve">${esc(message.message)}</p><span class="tag">${message.read?'Lida':'Nova'}</span></div><form data-id="${esc(message.id)}"><button class="button outline">${message.read?'Marcar como nova':'Marcar como lida'}</button><button type="button" data-delete>Excluir</button><p class="feedback" role="status"></p></form></article>`).join(''):empty('Nenhuma mensagem','As mensagens do formulário de contato aparecem aqui.')}`;
    view.querySelectorAll('form').forEach(form=>{
      form.onsubmit=event=>{event.preventDefault();if(persist(form,()=>store.update(data=>{const msg=data.messages.find(m=>m.id===form.dataset.id);if(!msg)throw Error('Mensagem não encontrada.');msg.read=!msg.read;}),'Atualizado.'))refresh('Mensagem atualizada.');};
      form.querySelector('[data-delete]').onclick=()=>confirmAction('Excluir mensagem?','A mensagem será removida do armazenamento local.',()=>store.update(data=>{data.messages=data.messages.filter(m=>m.id!==form.dataset.id);}));
    });
  }
  function settingsAdmin(view){
    const content=tab==='content',c=db.content,s=db.settings;
    view.innerHTML=`<h2>${content?'Conteúdo do site':'Configurações'}</h2><form class="form-box settings-form">${content?
      textarea('title','Título de abertura',c.title,'required rows="2" maxlength="100"')+textarea('intro','Texto de abertura',c.intro,'required rows="3" maxlength="400"')+input('aboutTitle','Título da seção Sobre',c.aboutTitle,'required maxlength="100"')+textarea('about','Texto da seção Sobre',c.about,'required rows="5" maxlength="2000"'):
      input('whatsapp','WhatsApp com país e DDD',s.whatsapp,'type="tel" maxlength="35" placeholder="+55 (DDD) número"')+'<p class="muted">Use um número autorizado. Em branco, o botão funciona em modo demonstrativo.</p>'+input('email','E-mail demonstrativo',s.email,'type="email" required maxlength="150"')+input('phone','Telefone (opcional)',s.phone,'type="tel" maxlength="35"')+input('city','Cidade',s.city,'required maxlength="100"')+input('hours','Horário de atendimento',s.hours,'required maxlength="180"')+(C.mode==='table'?input('tableCapacity','Lugares por horário de reserva',s.tableCapacity,'type="number" min="1" max="5000" step="1" required'):'')+`<label class="checkbox"><input type="checkbox" name="open" ${s.open?'checked':''}> Permitir novas solicitações</label>`}
      <button class="button primary">Salvar alterações</button><p class="feedback" role="status"></p></form>`;
    const form=view.querySelector('form');
    form.onsubmit=event=>{
      event.preventDefault();const fields=values(form);
      persist(form,()=>store.update(data=>{
        if(content){if(Object.values(fields).some(v=>!v))throw Error('Preencha todos os textos.');data.content=fields;}
        else {if(fields.whatsapp&&!M.whatsappURL(fields.whatsapp,'Teste'))throw Error('Informe um número válido com código do país e DDD.');data.settings={...data.settings,...fields,open:!!fields.open,tableCapacity:Number(fields.tableCapacity||data.settings.tableCapacity)};}
      }),'Alterações salvas. O site foi atualizado.');
    };
    if(!content){
      view.insertAdjacentHTML('beforeend','<div class="data-tools"><h3>Cópia dos dados locais</h3><p>Exporte os dados para guardar uma cópia ou importar neste mesmo projeto em outro navegador. A cópia pode incluir dados inseridos nos formulários.</p><button type="button" id="export-data">Exportar JSON</button><label>Importar cópia JSON<input type="file" id="import-data" accept=".json,application/json"></label><p id="data-feedback" role="status"></p></div>');
      document.getElementById('export-data').onclick=()=>{
        const blob=new Blob([JSON.stringify({project:C.slug,data:store.read()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
        const link=document.createElement('a');link.href=url;link.download=C.slug+'-dados.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      };
      document.getElementById('import-data').onchange=async event=>{
        const file=event.target.files[0];event.target.value='';if(!file)return;
        try{
          if(file.size>10*1024*1024)throw Error('Arquivo maior que 10 MB.');
          const copy=JSON.parse(await file.text());
          if(copy.project!==C.slug||!Array.isArray(copy.data?.items)||!Array.isArray(copy.data.requests)||!Array.isArray(copy.data.messages)||!copy.data.settings||!copy.data.content)throw Error('Cópia incompatível com este projeto.');
          copy.data.items.forEach(store.validateItem);
          if(copy.data.requests.some(r=>!M.statuses.includes(r.status)))throw Error('Solicitações inválidas na cópia.');
          confirmAction('Substituir dados locais?','Os dados desta cópia substituirão os dados atuais deste projeto no navegador.',()=>{localStorage.setItem(store.key,JSON.stringify(copy.data));});
        }catch(error){document.getElementById('data-feedback').textContent=error.message;}
      };
    }
  }
  function route(focus=false) {
    read();if(dialog.open)dialog.close();
    document.title=C.name+' — '+C.sector;
    document.querySelector('meta[name=description]').content=C.intro;
    const hash=location.hash.slice(1);
    if(hash==='painel'){admin();document.title='Painel | '+C.name;}
    else if(hash.startsWith('detalhe/')){let id='';try{id=decodeURIComponent(hash.slice(8));}catch{}detail(id);}
    else home();
    const anchor=['inicio','catalogo','sobre','contato'].includes(hash)?document.getElementById(hash):null;
    if(focus){const target=anchor||main;target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
    if(anchor)anchor.scrollIntoView();else window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',()=>route(true));
  window.addEventListener('storage',event=>{if(event.key===store.key){read();if(!dialog.open&&!main.contains(document.activeElement))route();}});
  route();
})();
