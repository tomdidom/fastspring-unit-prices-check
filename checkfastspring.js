/*
This script finds all subscriptions that have a change in unit price.
There is no reason for this to happen if you haven't changed the unit 
prices of your products yourself. The unit price of your product
should otherwise not change during the lifetime of a subscription. 
If it does change that usually indicates something is up. 

I know of two problems:
1. In te period march 2022 to october 2022 buyers were overcharged because 
   of a bug in fastspring.
2. Fastspring sometimes suddenly makes the unit price VAT inclusive instead 
   of VAT exclusive.

The script will create three csv files
all-subscriptions-with-unit-price-change.csv
subscriptions-with-overcharge-2022-issue.csv
subscriptions-with-VAT-inclusive-issue.csv

To start the script you need to provide your username and password for the 
fastspring api. These are not username and password that you use to log in 
into the FastSpring website. It's the username and password that your backend 
uses when making contact with FastSpring API/servers. Starting this script 
with a username and password would look something like this:
node checkfastspring.js yourusername yourpassword
*/

var unirest = require('unirest');
var fs = require('fs');

var csvfileall,counterall,csvfileovercharged, counterovercharged,csvfilevatinclusive,countervatinclusive,numberofpages,authtoken; 

if(process.argv.length==4){

  console.log("Analyzing started")
  console.log("this can take a while...")
  console.log("Impatient? You can make a copy of the csv files it is creating to see the first results.")
  console.log("The script will continue to run and will finish when it's done.")
  
  authtoken = Buffer.from(process.argv[2]+':'+process.argv[3]).toString('base64');
  
  //initialize the csv files
  csvfileall = fs.createWriteStream('all-subscriptions-with-unit-price-change.csv');
  csvfileovercharged = fs.createWriteStream('subscriptions-with-overcharge-2022-issue.csv');
  csvfilevatinclusive = fs.createWriteStream('subscriptions-with-VAT-inclusive-issue.csv');
  
  //write the headers of the csv files
  csvfileall.write("counter,subscription ref,currency,amount overcharged,cost. to vendor, due to VAT inclusive unnit price,cost due to unknown issue to vendor,link\n");
  csvfileovercharged.write("counter,subscription,amount overcharged,currency,link\n");
  csvfilevatinclusive.write("counter,subscription,cost to vendor,currency,link\n");
  
  //initialize the counters
  counterall = 0;
  counterovercharged = 0;
  countervatinclusive = 0;
  numberofpages = 0;
    
  //we start by calculating the last pagenumber of the pages of subscriptions so we start with the oldest subscriptions first and work our way to the newest
  unirest('GET', 'https://api.fastspring.com/subscriptions?begin=2005-01-01&end=2030-01-01&event=created&scope=live&page=1')//fastspring was founded in 2005 so we start with that date
    .headers({
      'Authorization': 'Basic '+authtoken
    })
    .end(function (res) {
      if (res.error) {
        console.log("there was an error communicating with the fastspring api, it's most likely that your username and password are not correct");
        process.exit();
      }; 
      numberofpages = Math.ceil(res.body.total/50);
      analyze50subscriptions(numberofpages,numberofpages);
    }
  );
}
else{
  console.log("Please provide the credentials for access to the FastSpring API."); 
  console.log("Note: these are not username and password that you use to log in into the FastSpring website. It's a username and password that your backend uses when making contact with FastSpring API/servers."); 
  console.log("If you don't have an intergation with the FastSpring API yet then you can create a username/password pair at https://app.fastspring.com/ under Integrations > API Credentials");
  console.log("Starting this script with a username and password would look something like this 'node checkfastspring.js yourusername yourpassword'.");
  process.exit();
}


var analyze50subscriptions = (page,numberofpages) => {
  //fetch the next 50 subscriptions      
  console.log("fetching page " + page + " of " + numberofpages);
  var req = unirest('GET', 'https://api.fastspring.com/subscriptions?begin=2009-10-01&end=2022-10-15&event=created&scope=live&page='+page)
  .headers({
    'Authorization': 'Basic '+authtoken
  })
  .end(function (res) {
    if (res.error) throw new Error(res.error);
    //cycle through the subscriptions 
    for (var index in res.body.subscriptions){
      var subscriptionid = res.body.subscriptions[index].id
      //fetch the orders related to this subscription
      var req = unirest('GET', 'https://api.fastspring.com/subscriptions/'+subscriptionid+'/entries')
      .headers({
        'Authorization': 'Basic '+authtoken
      })
      .end(function (res) {
        if (res.error) throw new Error(res.error); 

        //first some subscription variables
        var payments = res.body; 
        var issuefound = '';
        var initorder = payments[payments.length-1].order;
        var subscriptionref = initorder.items[0].subscription;  

        //check if order/subscription has more than 1 item, this script does not handle that
        if(initorder.items.length>1){
          console.log("subscription " + subscriptionref + " has more than 1 item, unable to analyze");
          return;
        }

        //we take the first order as the starting point to spot changes in the unit price
        var prevcurrency = initorder.currency;
        var prevsku = initorder.items[0].sku;
        var previtemcost = initorder.items[0].subtotal;
        var prevordercost = initorder.total;
        
        //some counter to calculate incurred costs or overcharges        
        var amountovercharged2022issue = 0;
        var costduetoVATinclusiveissue = 0;
        var costunknownissue = 0;
        
        //boolean to check if there is an issue
        var bolissuefound = false;
        
        for(var index=payments.length-2;index>=0;index--) {
          //cycle through all orders of a subscription that came after the first order
          var order = payments[index].order;

          //check if order/subscription has more than 1 item, this script does not handle that
          if(order.items.length>1){
            console.log("subscription " + subscriptionref + " has more than 1 item, unable to analyze");
            return;
          }

          if(order.completed){//was the order successful?
            if(prevcurrency == order.currency && prevsku == order.items[0].sku && previtemcost != order.items[0].subtotal) {
              // if the sku and currency didn't change from the previousorder but the unit price did then 
              // we found an affected order and subscription
              //find possible cause of the issue
              bolissuefound = true;
              if(order.changed>(new Date(2022,0,1)).valueOf() && order.total>prevordercost) {
                //if the order took place in 2022 and the unit price increased 
                //then we most likely found a subscription impacted by the 2022 overcharge issue
                amountovercharged2022issue = amountovercharged2022issue + order.total-prevordercost;//keep track of the total overcharge amount for this subscription
              }
              else if(order.items[0].subtotal+order.tax==prevordercost) {
                //the unit new price + the vat is equal to the old unit price,
                //so the unit price was adjusted to accomodate a change in the VAT
                //which makes the unit price vat inclusive
                costduetoVATinclusiveissue = costduetoVATinclusiveissue + (previtemcost-order.items[0].subtotal);//keep track of the total undercharge amount for this subscription
              }
              else {
                //yet unknown issue 
                costunknownissue = costunknownissue + (previtemcost-order.items[0].subtotal);//keep track of the total cost to this subscription (negative value means undercharged)
              }
            }
            else{
              //when unit price did not change (or the price did change but the currency/sku changed as well) 
              //then we consider this order to be priced correctly so we compare the next order to this one
              prevcurrency = order.currency;
              prevsku = order.items[0].sku;
              previtemcost = order.items[0].subtotal;
              prevordercost = order.total;
            }
          }
        }
        if(bolissuefound){
          counterall++
          console.log(counterall,"issue found with subscription" + subscriptionref);
          csvfileall.write(counterall+','+subscriptionref+','+order.currency+','+Number(amountovercharged2022issue).toFixed(2)+','+Number(costduetoVATinclusiveissue).toFixed(2)+','+Number(costunknownissue).toFixed(2)+','+'https://app.fastspring.com/subscription/home.xml?mRef=Subscription%3A'+subscriptionref+'\n');
          if(amountovercharged2022issue>0) {
            counterovercharged++;
            csvfileovercharged.write(counterovercharged+','+subscriptionref+','+Number(amountovercharged2022issue).toFixed(2)+','+prevcurrency+',https://app.fastspring.com/subscription/home.xml?mRef=Subscription%3A'+order.items[0].subscription+'\n');
          }
          if(costduetoVATinclusiveissue>0){
            countervatinclusive++;
            csvfilevatinclusive.write(countervatinclusive+','+subscriptionref+','+Number(costduetoVATinclusiveissue).toFixed(2)+','+prevcurrency+',https://app.fastspring.com/subscription/home.xml?mRef=Subscription%3A'+order.items[0].subscription+'\n');
          }
        }
      });
    }
    if(page>1){ //if we are not on the first page then fetch and analyze the next page
      analyze50subscriptions(page-1,numberofpages);
    }
    else{
      //wait for 5000ms before closing the files and writing the results to the console
      //so that still outstanding api calls can finish
      new Promise(function(){
        setTimeout(function(){
          //close the csv files
          csvfileall.end();
          csvfileovercharged.end();
          csvfilevatinclusive.end();

          //write the results to the console
          console.log("done");
          console.log(counterall,"affected subscriptions");
          console.log("of which",counterovercharged,"due to 2022 overcharge issue");
          console.log("of which",countervatinclusive,"due to VAT inclusive issue");
          console.log("the results are stored in the files:");
          console.log("all-subscriptions-with-unit-price-change.csv");
          console.log("subscriptions-with-overcharge-2022-issue.csv");
          console.log("subscriptions-with-VAT-inclusive-issue.csv");
        }, 5000)});
    }
  });
}








