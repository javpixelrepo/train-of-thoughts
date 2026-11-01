// One apartment per floor. Rooms open onto a continuous entrance hall.
// Illustrative metres: front is +Z, entrance from the exterior stair landing.
const room=(name,type,d,description,extra={})=>({name,type,d,description,...extra});
function apartment(name,type,description,leftWidth,left,right,balcony){
 const hallWidth=1.1,rightWidth=8.5-leftWidth-hallWidth,hallX=-4.25+leftWidth+hallWidth/2,rooms=[];
 for(const [side,list,w,x] of [['left',left,leftWidth,-4.25+leftWidth/2],['right',right,rightWidth,4.25-rightWidth/2]]){
  let front=3.9;
  for(const spec of list){rooms.push({...spec,w,x,z:front-spec.d/2,side,frontExterior:front===3.9,backExterior:Math.abs(front-spec.d+3.9)<.001});front-=spec.d;}
  if(Math.abs(front+3.9)>.001)throw new Error(name+': rooms must fill each wing');
 }
 return {name,type,description,rooms,hall:{x:hallX,w:hallWidth},balcony};
}
export const FLOORS=[
 apartment('The reader’s apartment','1 bedroom · 1 bathroom','A ground-floor home around an entrance gallery, without a balcony. A generous living room faces the garden; the bedroom sits behind it. A separate kitchen, reading study and bathroom occupy the opposite wing, with the study keeping cooking and bathing apart.',4.1,[
  room('Living & dining','living',4.5,'A three-seat sofa, low media cabinet and a round dining table share the garden-facing living room.',{variant:0,art:0}),
  room('Main bedroom','bedroom',3.3,'A double bed, built-in wardrobe and asymmetric bedside furniture overlook the quiet rear façade.',{variant:0,art:1})
 ],[
  room('Separate kitchen','kitchen',2.5,'A full-height refrigerator, oven, sink and cooking surface line the back wall. A breakfast table sits by the window.',{variant:0,doorZ:.25}),
  room('Reading study','study',3.1,'A writing desk, tall bookshelves and a reading chair form a buffer between kitchen and bathroom.',{variant:0,art:2}),
  room('Bath & laundry','bathroom',2.2,'A bathtub, WC and vanity share a tiled bathroom with a washing machine beneath the counter.',{tub:true,laundry:true})
 ],{side:'left',z:1.4,length:4.7,depth:1.35,style:'reading'}),
 apartment('The family home','2 bedrooms · 1 bathroom','Two separate bedrooms, an L-shaped living area and a dedicated eat-in kitchen form a single family home. Every room opens onto the hall; the second bedroom separates kitchen and bathroom. A planted balcony extends the living room.',4.3,[
  room('Family living','living',4.6,'An L-shaped sectional, family table and toy cabinet leave a clear route from hall to balcony.',{variant:1,art:3}),
  room('Parents’ bedroom','bedroom',3.2,'A double bed, sliding-door wardrobe and paired bedside tables create a quiet main bedroom.',{variant:1})
 ],[
  room('Family kitchen','kitchen',2.4,'A refrigerator-freezer, oven, cooktop and sink form one compact kitchen, with a small breakfast perch.',{variant:1,doorZ:.25}),
  room('Child’s bedroom','singleBedroom',3.2,'A single bed, study desk and low storage leave an open play area.',{art:4,doorZ:.55}),
  room('Family bathroom','bathroom',2.2,'A fitted bathtub, broad vanity and WC serve both bedrooms.',{tub:true})
 ],{side:'left',z:1.35,length:4.9,depth:1.65,style:'family',furnitureOffsetZ:-.4}),
 apartment('The creative loft','1 bedroom · Studio · Gym','One home with an open kitchen and lounge, a private bedroom and an art studio. A compact exercise room separates the studio from the rear shower room. The only kitchen stays at the front of the living space.',4.6,[
  room('Loft kitchen & living','livingKitchen',5,'One open kitchen with a refrigerator and breakfast island shares a deep room with a relaxed lounge.',{variant:0,art:5}),
  room('Quiet bedroom','bedroom',2.8,'A low double bed, wall-mounted bedside shelves and a shallow wardrobe keep this sleeping room uncluttered.',{variant:2})
 ],[
  room('Art studio','artStudio',3.6,'An easel, worktable, drawing stool and materials shelves face the balcony. Selected finished studies lean against the wall.',{art:6,doorZ:.2,balconyDoorZ:0}),
  room('Mini gym','gym',2.2,'An exercise bike, rolled mat and compact weight rack create a dedicated workout space.',{variant:0}),
  room('Shower room','bathroom',2,'A walk-in shower, vanity and WC occupy the rear service room, reached directly from the hall.')
 ],{side:'right',z:1.9,length:3.8,depth:1.4,style:'studio'}),
 apartment('The wellness apartment','1 bedroom · 2 bathrooms','A large lounge, separate kitchen and private exercise room serve one bedroom. A guest WC and full bathroom have independent hall entrances at the rear, with the gym separating them from the kitchen.',4.0,[
  room('Generous living room','living',4.6,'Two facing sofas, an oval coffee table and a compact dining setting create a more social living room.',{variant:2,art:7,doorZ:1.2}),
  room('Main bedroom','bedroom',3.2,'A double bed, dressing bench and generous wardrobe form a quiet retreat.',{variant:3,art:8})
 ],[
  room('Galley kitchen','kitchen',2.4,'A tall refrigerator and full appliance run face a narrow breakfast counter.',{variant:2,doorZ:.25}),
  room('Movement studio','gym',2,'A treadmill, stretching mat and dumbbells form a small home gym.',{variant:1,doorZ:.2}),
  room('Guest WC','powder',1.4,'A separate guest toilet and hand basin are entered directly from the hall.'),
  room('Soaking bathroom','bathroom',2,'A bathtub along the rear wall, compact vanity and WC fit across this wide bathroom.',{tub:true})
 ],{side:'left',z:.5,length:5.8,depth:1.2,style:'wellness'}),
 apartment('The work-from-home residence','2 bedrooms · 2 bathrooms','An open living space with one kitchen serves two bedrooms and a dedicated home office. A guest WC and shower room sit beyond the office, keeping bathroom doors away from cooking. A long balcony offers a second place to work.',4.4,[
  room('Open living & kitchen','livingKitchen',4.8,'A single appliance wall with refrigerator, dining table and corner sofa define the shared living space.',{variant:1,art:9}),
  room('Main bedroom','bedroom',3,'A double bed and offset storage wall give this room a different arrangement from the family home.',{variant:4})
 ],[
  room('Guest bedroom','singleBedroom',2.8,'A daybed, compact wardrobe and side table serve guests without repeating the main bedroom furnishings.',{variant:1,art:10,doorZ:.45,balconyDoorZ:.25}),
  room('Home office','study',2,'A workstation with monitor, task chair and wall storage sits between the guest room and bathrooms.',{variant:1,doorZ:.45}),
  room('Guest WC','powder',1.4,'A WC and small basin provide a second, independent bathroom.'),
  room('Main shower room','bathroom',1.6,'A shower, vanity and WC occupy the apartment’s rear service room.')
 ],{side:'right',z:0,length:6.6,depth:1.25,style:'work'}),
 apartment('The garden penthouse','1 bedroom · Garden terrace','A broad living room with one kitchen and a full-width bedroom occupy the main wing. A study and bathtub room sit across the entrance gallery, which leads to an open garden terrace with outdoor dining.',4.5,[
  room('Penthouse living & kitchen','livingKitchen',4.6,'One kitchen with refrigerator, sink and cooktop opens to a lounge, round dining table and selected artwork.',{variant:2,art:11}),
  room('Penthouse bedroom','bedroom',3.2,'A double bed, dressing cabinet and reading chair face the quiet side of the building.',{variant:5,art:12})
 ],[
  room('Writing room','study',2.4,'A writing desk with task lighting and open bookshelves leaves a clear entrance beside the front façade.',{variant:2,doorZ:.4}),
  room('Penthouse bathroom','bathroom',2,'A bathtub, vanity and WC sit off the gallery, with an enclosed entrance.',{tub:true}),
  room('Garden terrace','garden',3.4,'An open deck with pergola, bistro table and planted edges is reached from the gallery, with no roof over the garden.')
 ],{side:'left',z:1.5,length:4.8,depth:1.8,style:'garden',furnitureOffsetZ:-1.1})
];
export const SPACE_COUNT=FLOORS.reduce((n,f)=>n+f.rooms.length,0);
