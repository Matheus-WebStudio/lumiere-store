(function portfolioModel(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  };
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const active = request => !['Cancelada','Concluída','Recusada'].includes(request.status);
  const statuses = ['Nova','Confirmada','Concluída','Cancelada','Recusada'];
  function imageURL(src) {
    if (/^assets\/[a-z0-9-]+\.jpg$/i.test(src) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(src)) return src;
    try { const url = new URL(src); if (url.protocol === 'https:') return url.href; } catch {}
    return '';
  }
  function whatsappURL(value, message) {
    const digits = String(value || '').replace(/[\s()+.-]/g,'');
    return /^[1-9]\d{7,14}$/.test(digits) ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '';
  }
  function create(config, storage) {
    const key = 'mws-demo-' + config.slug + '-v1';
    const seed = {
      version:1, items:clone(config.items), requests:[], messages:[],
      settings:{whatsapp:'',email:`contato@${config.slug}.example`,phone:'',city:'São Paulo',hours:'Segunda a sábado · 09h às 18h',open:true,tableCapacity:24},
      content:{title:config.title,intro:config.intro,aboutTitle:config.aboutTitle,about:config.about}
    };
    function read() {
      const saved = storage.getItem(key);
      if (!saved) return clone(seed);
      const db = JSON.parse(saved);
      if (!Array.isArray(db.items) || !Array.isArray(db.requests) || !Array.isArray(db.messages)) throw Error('Os dados locais têm um formato incompatível. Exporte uma cópia antes de restaurar.');
      return {...db,settings:{...seed.settings,...db.settings},content:{...seed.content,...db.content}};
    }
    function update(change) {
      const db = read();
      change(db);
      storage.setItem(key,JSON.stringify(db));
      return db;
    }
    function validateItem(item) {
      if (!String(item.title || '').trim() || !String(item.category || '').trim() || !String(item.description || '').trim()) throw Error('Preencha nome, categoria e descrição.');
      if (!Number.isFinite(item.price) || item.price < 0) throw Error('Informe um valor válido.');
      for (const [field,label,type] of config.fields) {
        if (type === 'number' && (!Number.isFinite(item[field]) || item[field] < 0)) throw Error('Confira o campo ' + label + '.');
        if (['capacity','units','stock','hours','duration','year'].includes(field) && !Number.isInteger(item[field])) throw Error('Use um número inteiro em ' + label + '.');
        if (['capacity','units','hours','duration'].includes(field) && item[field] < 1) throw Error(label + ' deve ser maior que zero.');
      }
      if (config.mode === 'shop' && !String(item.variants || '').trim()) throw Error('Cadastre pelo menos um tamanho.');
      if (item.images.length > 8 || item.images.some(photo => !imageURL(photo.src) || !photo.alt.trim())) throw Error('Confira os endereços e as descrições das imagens. Limite de 8 fotos.');
      if (item.published && !item.images.length) throw Error('Adicione uma imagem para publicar.');
    }
    function submitRequest(fields, basket = []) {
      return update(db => {
        if (!db.settings.open) throw Error('Os atendimentos estão temporariamente pausados.');
        if (!fields.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email || '')) throw Error('Preencha nome e e-mail válidos.');
        for (const [name,label,,required] of config.extra || []) if (required && !String(fields[name] || '').trim()) throw Error('Preencha ' + label + '.');
        const request = {...fields,id:id(),created:new Date().toISOString(),status:'Nova',mode:config.mode};
        if (config.mode === 'shop') {
          if (!basket.length) throw Error('Sua sacola está vazia.');
          const combined = new Map();
          for (const row of basket) {
            const k = row.itemId + '/' + row.variant;
            const prior = combined.get(k);
            combined.set(k,{...row,quantity:Number(row.quantity)+(prior?.quantity || 0)});
          }
          request.lines = [...combined.values()].map(row => {
            const item = db.items.find(i => i.id === row.itemId);
            const variants = String(item?.variants || '').split(',').map(v => v.trim());
            if (!item?.published || !item.available || !variants.includes(row.variant)) throw Error('Um produto da sacola está indisponível. Revise sua seleção.');
            if (!Number.isInteger(row.quantity) || row.quantity < 1) throw Error('Confira as quantidades da sacola.');
            if ((item.variantStock?.[row.variant] ?? item.stock) < row.quantity) throw Error(`Estoque insuficiente para ${item.title}, tamanho ${row.variant}.`);
            item.variantStock ??= {};
            item.variantStock[row.variant] = (item.variantStock[row.variant] ?? item.stock) - row.quantity;
            return {...row,title:item.title,price:item.price};
          });
          request.total = request.lines.reduce((sum,row) => sum + row.price*row.quantity,0);
        } else {
          const item = db.items.find(i => i.id === fields.itemId);
          if (!item?.published || !item.available) throw Error('Esta opção está indisponível. Escolha outra.');
          request.itemTitle = item.title;
          request.people = Number(fields.people || 1);
          if (!Number.isInteger(request.people) || request.people < 1) throw Error('Informe uma quantidade válida de pessoas.');
          if (config.date && (!dateValid(fields.date) || fields.date < today())) throw Error('Escolha uma data a partir de hoje.');
          if (config.time && config.mode !== 'table' && !['09:00','11:00','14:00','16:00','18:00'].includes(fields.time)) throw Error('Escolha um dos horários disponíveis.');
          const occupied = db.requests.filter(active);
          if (config.mode === 'hotel') {
            if (!dateValid(fields.endDate) || fields.endDate <= fields.date) throw Error('A saída deve ser posterior à entrada.');
            if (request.people > item.capacity) throw Error('A quantidade de hóspedes excede a capacidade desta acomodação.');
            // Check peak nightly occupancy, allowing adjacent stays.
            const overlapping = occupied.filter(r => r.itemId === item.id && r.date < fields.endDate && r.endDate > fields.date);
            const checkpoints = [fields.date,...overlapping.map(r=>r.date).filter(day=>day >= fields.date && day < fields.endDate)];
            if (checkpoints.some(day => overlapping.filter(r=>r.date <= day && r.endDate > day).length >= item.units)) throw Error('Sem unidades disponíveis para esse período.');
            request.nights = Math.round((Date.parse(fields.endDate)-Date.parse(fields.date))/86400000);
            request.total = request.nights*item.price;
          } else if (config.mode === 'table') {
            if (!['12:00','14:00','19:00','21:00'].includes(fields.time)) throw Error('Selecione um horário de reserva.');
            const used = occupied.filter(r=>r.date===fields.date && r.time===fields.time).reduce((sum,r)=>sum+r.people,0);
            if (used + request.people > db.settings.tableCapacity) throw Error('Este horário está sem lugares suficientes. Experimente outro horário.');
          } else if (config.mode === 'enrollment') {
            const count = occupied.filter(r=>r.itemId===item.id).reduce((sum,r)=>sum+r.people,0);
            if (count + request.people > item.capacity) throw Error('Esta turma está sem vagas.');
            request.total = item.price;
          } else if (config.mode === 'appointment') {
            const count = occupied.filter(r=>r.itemId===item.id && r.date===fields.date && r.time===fields.time).reduce((sum,r)=>sum+r.people,0);
            if (count + request.people > item.capacity) throw Error('Horário sem vagas suficientes. Escolha outro.');
          }
        }
        db.requests.unshift(request);
      });
    }
    function changeStatus(requestId,status) {
      return update(db => {
        if (!statuses.includes(status)) throw Error('Status inválido.');
        const r = db.requests.find(item=>item.id===requestId);
        if (!r) throw Error('Solicitação não encontrada.');
        if (['Cancelada','Recusada'].includes(r.status) && status !== r.status) throw Error('A solicitação está encerrada. Registre uma nova para conferir a disponibilidade.');
        if (r.status === 'Concluída' && status !== r.status) throw Error('A solicitação já foi concluída.');
        if (r.mode === 'shop' && !['Cancelada','Recusada'].includes(r.status) && ['Cancelada','Recusada'].includes(status)) {
          for (const line of r.lines) {
            const item = db.items.find(i=>i.id===line.itemId);
            if (item) {
              item.variantStock ??= {};
              item.variantStock[line.variant] = (item.variantStock[line.variant] ?? item.stock)+line.quantity;
            }
          }
        }
        r.status=status;
      });
    }
    function search(filters = {}) {
      return read().items.filter(item=>item.published &&
        (!filters.q || normalize([item.title,item.category,item.description,...config.fields.map(f=>item[f[0]])].join(' ')).includes(normalize(filters.q))) &&
        (!filters.category || item.category===filters.category) &&
        (!filters.max || item.price<=Number(filters.max)) &&
        (!filters.available || item.available));
    }
    return {key,seed,read,update,validateItem,submitRequest,changeStatus,search};
  }
  const api={create,clone,id,today,dateValid,active,statuses,imageURL,whatsappURL};
  if (typeof module !== 'undefined') module.exports=api;
  else root.PortfolioModel=api;
})(globalThis);
