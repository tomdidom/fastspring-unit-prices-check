# fastspring-unit-prices-check

## For who?
If you have a business, like me, with Tom's Planner, and you sell subscriptions through FastSpring, then this script is for you.

## Why?
We discovered that FastSpring changes the unit prices of our products during the lifetime of the subscription of some of our users without notifying us.

This has caused them to undercharge our users in quite a few cases costing us money, and in other cases, it has caused them to overcharge our users, leading to complaints and a break in trust.

We wrote this nodejs script to find all these cases. 

## what does the script do?
This script will go through all your subscriptions using the FastPSring API and finds all subscriptions where the unit price of the product changes at some point without good reason. It will save the results to the file 'all-subscriptions-with-unit-price-change.csv'. 

There are two groups of issues that stand out.

The first one we are calling the '2022 overcharge' issue. We were told there was a bug in FastSprings system during the months of march to October, causing FastSpring to overcharge some of our users. The script will list these issues in a separate file called 'subscriptions-with-overcharge-2022-issue.csv'. This bug causes buyers to pay more than they should. We have had to refund hundreds of buyers for up to 50 euros per buyer. 

And the second group we call the 'vat-inclusive' issue. We have found that FastSpring sometimes makes unit prices for users suddenly VAT inclusive instead of keeping them VAT exclusive as they should be. This issue causes the vendor to pay the VAT instead of the buyer paying it. We seem to have lost thousands of dollars up to this point due to this issue and it seems to be still ongoing. The script will list them in a separate file called 'subscriptions-with-VAT-inclusive-issue.csv'.

## How to run this script?

1. Install npm and nodejs if you don't have them installed yet.
2. Download this repository.
3. Run the command 'npm install' in the script's directory to install its dependencies.
4. And then start the script with the command:
node checkfastspring.js yourusername yourpassword

About the username and password: these are the username and password for the fastspring API. So note that these are not the username and password you use to log in to the FastSpring website. 

If you already have an integration with the FastSpring API you should be able to find these credentials in your own codebase.

If you don't have an integration with the FastSpring API yet, then you can create a username/password pair at https://app.fastspring.com/ under Integrations > API Credentials

## I want to hear from you?
You can contact me at tom@tomsplanner.com. I am curious to how others heve been impacted. And, if you run into a problem jsut let me know. I am happy to help you out.



