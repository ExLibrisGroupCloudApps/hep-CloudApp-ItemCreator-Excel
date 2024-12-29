import { Injectable } from '@angular/core';
import { CloudAppRestService, HttpMethod, RestErrorResponse } from '@exlibris/exl-cloudapp-angular-lib';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ItemService {

  constructor(
    private restService: CloudAppRestService

  ) { }

  processCreateItem(item: any) {
    if(!(item.mms_id && item.holding_id)){
      return of(this.handleError({ok:false, status:"", message:"Keys mms_id and holding_id are needed", statusText:"", error:true}, item));
    }
    const mms_id = item.mms_id;
    const holding_id = item.holding_id;
    let url = `/bibs/${mms_id}`;
    const itemToSend = this.getItemToSend(item);

    console.log(itemToSend);

    return this.restService.call(url).pipe(
      switchMap(resp => {
        console.log(resp, item);
        if (resp.mms_id == null) {
          return of(this.handleError({ 
            ok: false, 
            status: "", 
            message: `Mms ID ${mms_id} does not exist`, 
            statusText: "", 
            error: true 
          }, item));
        }
        url += `/holdings/${holding_id}`;
        return this.restService.call(url).pipe(
          switchMap(resp => {
            console.log(resp, item);
            if (resp.holding_id == null) {
              return of(this.handleError({ 
                ok: false, 
                status: "", 
                message: `Holding ID ${holding_id} does not exist`, 
                statusText: "", 
                error: true 
              }, item));
            }
            url += `/items`;
            return this.restService.call({
              url,
              method: HttpMethod.POST,
              requestBody: itemToSend
            }).pipe(
              catchError(e => {
                if (e.message.includes("Check holdings")) {
                  e.message = `Holding ID ${holding_id} does not exist`;
                }
                return of(this.handleError(e, item));
              })
            );
          }),
          catchError(e => {
            return of(this.handleError(e, item));
          })
        );
      }),
      catchError(e => {
        return of(this.handleError(e, item));
      })
    );
  }
  
  public handleError(e: RestErrorResponse, item: any) {
    if (item) {
      e.message = e.message + `\n(${JSON.stringify(item)})`;
    }
    return e;
  }
  private getItemToSend(item: any) {
    delete item.mms_id;
    delete item.holding_id;
    
    //remove empty lines
    for (const key in item) {
      if(key.includes("_EMPTY")) {
        delete item[key];
      }
    }

    //wrap into object for needed fields
    const keysToSendIntoObject = ["physical_material_type", "policy", "provenance", "break_indicator", "pattern_type",
    "alternative_call_number_type", "physical_condition", "committed_to_retain", "retention_reason",
    "temp_library", "temp_location", "temp_call_number_type", "temp_policy"];
    Object.keys(item).filter(key => keysToSendIntoObject.includes(key)).forEach(keyToChange => {
      const value = item[keyToChange];
      item[keyToChange] = {value: value};
    });

    //remove from item and add in holding obj holding fields
    const holding = {};
    const keysInHoldingData = ["copy_id", "in_temp_location", "temp_library", "temp_location", "temp_call_number_type",
      "temp_call_number", "temp_call_number_source", "temp_policy", "due_back_date"];
      Object.keys(item).filter(key => keysInHoldingData.includes(key)).forEach(keyInHolding => {
        const value = item[keyInHolding];
        delete item[keyInHolding];
        holding[keyInHolding] = value;
      });
    
    return {item_data: item, holding_data: holding};
  }

  
}